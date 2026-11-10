// Run: node --test tests/admin-orders.test.cjs
// Executes the shipped inline functions with controlled network/DOM dependencies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
function section(start, end) {
    const a = source.indexOf(start);
    const b = source.indexOf(end, a);
    assert.ok(a >= 0 && b > a, `Missing source section: ${start}`);
    return source.slice(a, b);
}
function elements() {
    const nodes = new Map();
    return { getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', checked: false,
            style: {}, disabled: false, addEventListener() {}, classList: { add() {}, remove() {} } });
        return nodes.get(id);
    }};
}
function makeContext(extra = {}) {
    const context = { document: elements(), console, AbortController, setTimeout, clearTimeout,
        window: { BACKEND_URL: '' }, adminAuthHeader: () => 'Bearer test',
        esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])),
        ...extra };
    vm.createContext(context);
    return context;
}
const response = data => ({ ok: true, status: 200, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

test('select-all selects only the current visible page and preserves other pages', () => {
    const context = makeContext({ selectedOrders: ['0'], filteredOrders: Array.from({ length: 45 }, (_, i) => ({ orderId: String(i) })),
        currentPage: 2, pageSize: 20, updateOrderSelectionButtons() {}, renderOrders() {} });
    vm.runInContext(section('function toggleSelectAllOrders()', 'async function executeBulkAction()'), context);
    context.document.getElementById('selectAllOrders').checked = true;
    context.toggleSelectAllOrders();
    assert.equal(context.selectedOrders.length, 21);
    assert.ok(context.selectedOrders.includes('20') && context.selectedOrders.includes('39'));
    assert.ok(!context.selectedOrders.includes('40'));
    context.document.getElementById('selectAllOrders').checked = false;
    context.toggleSelectAllOrders();
    assert.deepEqual([...context.selectedOrders], ['0']);
});

test('select-all excludes hidden test/invalid orders before page slicing', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ orderId: String(i), isTest: i < 5 }));
    const context = makeContext({ selectedOrders: [], filteredOrders: rows, currentPage: 1, pageSize: 20,
        updateOrderSelectionButtons() {}, renderOrders() {} });
    vm.runInContext(section('function toggleSelectAllOrders()', 'async function executeBulkAction()'), context);
    context.document.getElementById('selectAllOrders').checked = true;
    context.toggleSelectAllOrders();
    assert.equal(context.selectedOrders.length, 20);
    assert.ok(context.selectedOrders.includes('24') && !context.selectedOrders.includes('0'));
});

test('detail uses one main request and includes notes/history/logs', async () => {
    const calls = [], renders = [];
    const context = makeContext({ fetch: async url => { calls.push(url); return response({ success: true,
        order: { orderId: 'O1' }, storyRevision: { revised: 'story' }, itemRevisions: [{ id: 1 }], notes: [{ note: 'note' }], logs: [{ action: 'log' }] }); },
        showOrderModal: (...args) => renders.push(args) });
    vm.runInContext(section('// Order Detail：', 'function showOrderModal('), context);
    await context.viewOrder('O1');
    assert.deepEqual(calls, ['/api/admin/order/O1/detail']);
    assert.equal(renders[0][1].revised, 'story');
    assert.equal(renders[0][4][0].action, 'log');
});

test('slow A cannot replace B even when the network ignores cancellation', async () => {
    const a = deferred(), b = deferred(), renders = [];
    const context = makeContext({ fetch: url => url.includes('/A/') ? a.promise : b.promise,
        showOrderModal: order => renders.push(order.orderId) });
    vm.runInContext(section('// Order Detail：', 'function showOrderModal('), context);
    const first = context.viewOrder('A'), second = context.viewOrder('B');
    b.resolve(response({ success: true, order: { orderId: 'B' } })); await second;
    a.resolve(response({ success: true, order: { orderId: 'A' } })); await first;
    assert.deepEqual(renders, ['B']);
});

test('closing the modal prevents a late request from reopening it', async () => {
    const pending = deferred(), renders = [];
    const context = makeContext({ fetch: () => pending.promise, showOrderModal: order => renders.push(order) });
    vm.runInContext(section('// Order Detail：', 'function showOrderModal('), context);
    vm.runInContext(section('function closeModal()', '// Users'), context);
    const loading = context.viewOrder('O1');
    context.closeModal();
    pending.resolve(response({ success: true, order: { orderId: 'O1' } })); await loading;
    assert.equal(renders.length, 0);
});

test('detail failure clears the spinner and offers retry', async () => {
    const context = makeContext({ fetch: async () => ({ ok: false, status: 500, json: async () => ({ success: false, error: 'DB unavailable' }) }) });
    vm.runInContext(section('// Order Detail：', 'function showOrderModal('), context);
    await context.viewOrder('O1');
    const content = context.document.getElementById('orderDetailContent').innerHTML;
    assert.ok(content.includes('DB unavailable') && content.includes('retryOrderDetail'));
    assert.ok(!content.includes('載入訂單資料中'));
});

test('older backend fallback starts all four requests together', async () => {
    const pending = deferred(), calls = [];
    const context = makeContext({ fetch: async url => {
        calls.push(url);
        if (url.endsWith('/detail')) return { status: 404 };
        await pending.promise;
        if (url.startsWith('/api/order/')) return response({ success: true, order: { orderId: 'O1' } });
        return response({ success: true });
    }});
    vm.runInContext(section('// Order Detail：', 'function showOrderModal('), context);
    const result = context.fetchOrderDetail('O1', new AbortController().signal);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 5, 'legacy queries must not wait for one another');
    pending.resolve();
    assert.equal((await result).order.orderId, 'O1');
});

test('late log rendering uses its own container and does not recreate the form', () => {
    const context = makeContext({ activeOrderId: 'O1', formatTaiwanTime: value => value });
    vm.runInContext(section('function renderOrderLogs(', 'async function loadOrderLogs('), context);
    context.document.getElementById('orderDetailContent').innerHTML = 'form-with-unsaved-values';
    context.renderOrderLogs('O1', [{ action: '<unsafe>', admin_user: 'staff', created_at: 'now' }]);
    assert.equal(context.document.getElementById('orderDetailContent').innerHTML, 'form-with-unsaved-values');
    assert.ok(context.document.getElementById('orderLogs-O1').innerHTML.includes('&lt;unsafe&gt;'));
});

function bulkContext(extra = {}) {
    const context = makeContext({ bulkActionRunning: false, selectedOrders: ['shown-1', 'shown-2', 'paid-3'],
        allOrders: [{ orderId: 'shown-1', order_id: 'DB1', status: 'shipped' }, { orderId: 'shown-2', order_id: 'DB2', status: 'shipped' },
            { orderId: 'paid-3', status: 'paid' }], confirm: () => true, alert() {}, filterOrders() {}, renderCustomerStats() {},
        updateOrderSelectionButtons() {}, loadOrders() { throw Error('Full list refresh is unnecessary'); }, ...extra });
    vm.runInContext(section('async function confirmSelectedOrdersDelivered()', 'async function migrateOrderToDb('), context);
    return context;
}

test('bulk signing sends canonical shipped IDs only, preserves failures and patches rows locally', async () => {
    let sent;
    const context = bulkContext({ callApi: async (url, options) => {
        sent = { url, body: JSON.parse(options.body) };
        return response({ success: true, results: [{ orderId: 'DB1', success: true, status: 'delivered' },
            { orderId: 'DB2', success: false, error: '<failed>' }] });
    }});
    await context.confirmSelectedOrdersDelivered();
    assert.deepEqual(sent.body.orderIds, ['DB1', 'DB2']);
    assert.equal(context.allOrders[0].status, 'delivered');
    assert.deepEqual([...context.selectedOrders], ['shown-2', 'paid-3']);
    assert.ok(context.document.getElementById('bulkActionResult').innerHTML.includes('&lt;failed&gt;'));
    assert.equal(context.bulkActionRunning, false);
    assert.equal(context.document.getElementById('bulkActionBtn').disabled, false);
});

test('cancelled confirmation performs no network request', async () => {
    const context = bulkContext({ confirm: () => false, callApi() { throw Error('Must not send'); } });
    await context.confirmSelectedOrdersDelivered();
    assert.equal(context.selectedOrders.length, 3);
});

test('network failure preserves selection and does not claim success', async () => {
    const context = bulkContext({ callApi: async () => { throw Error('network unavailable'); } });
    await context.confirmSelectedOrdersDelivered();
    assert.equal(context.selectedOrders.length, 3);
    assert.ok(context.allOrders.every(row => row.status !== 'delivered'));
    assert.ok(context.document.getElementById('bulkActionResult').textContent.includes('重新整理確認狀態'));
});
