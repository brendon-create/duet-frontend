import { Button } from "@/components/ui/button";
import { ChevronRight, Download, Save, ShoppingCart } from "lucide-react";
import { useState } from "react";

/**
 * DUET Design Studio - Jewelry Customization Interface
 * Design Philosophy: Craftsmanship Workspace + Digital Precision
 * 
 * Visual Language:
 * - Deep Gray-Blue background (oklch(0.15 0.02 260))
 * - Ivory White text (oklch(0.95 0.005 65))
 * - Antique Bronze accents (oklch(0.65 0.15 65))
 * - Card-based UI for \"workbench\" feel
 * - Real-time visual feedback for parameter changes
 * - Ritual-like interaction design
 */

export default function DesignStudio() {
  const [letter1, setLetter1] = useState("B");
  const [letter2, setLetter2] = useState("S");
  const [material, setMaterial] = useState("925 銀");
  const [plating, setPlating] = useState("無");
  const [finish, setFinish] = useState("亮面");
  const [size, setSize] = useState("10 mm");
  const [price, setPrice] = useState(3850);

  // Simulate price calculation based on selections
  const calculatePrice = (m: string, p: string, f: string, s: string) => {
    let basePrice = 2800;
    if (m === "黃銅") basePrice = 2500;
    if (p === "18K 金") basePrice += 800;
    if (p === "18K 白K金") basePrice += 900;
    if (p === "18K 玫瑰金") basePrice += 850;
    if (s === "18 mm") basePrice += 300;
    return basePrice;
  };

  const handleMaterialChange = (m: string) => {
    setMaterial(m);
    setPrice(calculatePrice(m, plating, finish, size));
  };

  const handlePlatingChange = (p: string) => {
    setPlating(p);
    setPrice(calculatePrice(material, p, finish, size));
  };

  const handleFinishChange = (f: string) => {
    setFinish(f);
    setPrice(calculatePrice(material, plating, f, size));
  };

  const handleSizeChange = (s: string) => {
    setSize(s);
    setPrice(calculatePrice(material, plating, finish, s));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
              <span className="font-display text-lg text-accent-foreground">D</span>
            </div>
            <div>
              <h1 className="font-display text-xl text-foreground">DUET</h1>
              <p className="text-xs text-foreground/60">設計工作室</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-accent hover:bg-accent/10">
              <Download className="w-4 h-4 mr-2" />
              保存設計
            </Button>
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <ShoppingCart className="w-4 h-4 mr-2" />
              加入購物車
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-20 grid lg:grid-cols-3 gap-8 p-8">
        {/* Preview Section - Left */}
        <div className="lg:col-span-2 space-y-8">
          {/* 3D Preview Card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xl">
            <div className="aspect-video bg-gradient-to-br from-background to-card flex items-center justify-center relative overflow-hidden">
              {/* Simulated 3D Preview with Lighting Effect */}
              <div className="relative w-48 h-48">
                {/* Light source indicator */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />

                {/* Jewelry preview */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Outer ring */}
                    <div className="w-40 h-40 rounded-full border-2 border-accent/40 flex items-center justify-center">
                      {/* Inner glow */}
                      <div className="w-32 h-32 rounded-full bg-accent/10 flex items-center justify-center">
                        {/* Letters display */}
                        <div className="text-center space-y-2">
                          <div className="font-display text-5xl text-accent tracking-widest">
                            {letter1}
                          </div>
                          <div className="w-16 h-px bg-accent/50 mx-auto" />
                          <div className="font-display text-5xl text-accent tracking-widest">
                            {letter2}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shine effect */}
                    <div className="absolute top-4 left-8 w-12 h-12 bg-white/20 rounded-full blur-xl" />
                  </div>
                </div>
              </div>

              {/* Info overlay */}
              <div className="absolute bottom-4 left-4 right-4 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-4">
                <div className="text-sm text-foreground/70">
                  <p>
                    <span className="text-accent">材質</span>: {material}
                  </p>
                  <p>
                    <span className="text-accent">電鍍</span>: {plating}
                  </p>
                  <p>
                    <span className="text-accent">尺寸</span>: {size}
                  </p>
                </div>
              </div>
            </div>

            {/* Preview Controls */}
            <div className="p-6 bg-background border-t border-border space-y-4">
              <h3 className="font-display text-lg text-foreground">預覽設定</h3>
              <div className="grid grid-cols-3 gap-3">
                {["45°", "90°", "180°"].map((angle) => (
                  <button
                    key={angle}
                    className="px-4 py-2 bg-card border border-border rounded hover:border-accent/50 hover:bg-accent/10 transition text-sm text-foreground"
                  >
                    {angle}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Design Description */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-display text-lg text-foreground">您的設計</h3>
            <p className="text-foreground/70 leading-relaxed">
              這是一個客製化的珠寶設計，由 AI 設計諮詢和您的想法共同創作。每一個細節都經過精心考慮，以確保最終的作品完美呈現您的故事。
            </p>
            <div className="flex items-center gap-2 text-accent">
              <span className="text-sm">💎 高級手工製作</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Control Panel - Right */}
        <div className="space-y-6">
          {/* Price Display */}
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-6 space-y-2">
            <p className="text-foreground/70 text-sm">估計價格</p>
            <p className="font-display text-4xl text-accent">NT$ {price.toLocaleString()}</p>
            <p className="text-foreground/60 text-xs">最終價格可能因工藝複雜度而異</p>
          </div>

          {/* Customization Panels */}
          <div className="space-y-4">
            {/* Letters Selection */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="font-display text-lg text-foreground">字母選擇</h3>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm text-foreground/70 mb-2 block">第一個字母</span>
                  <select
                    value={letter1}
                    onChange={(e) => setLetter1(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-accent"
                  >
                    {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map((letter) => (
                      <option key={letter} value={letter}>
                        {letter}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm text-foreground/70 mb-2 block">第二個字母</span>
                  <select
                    value={letter2}
                    onChange={(e) => setLetter2(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-accent"
                  >
                    {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map((letter) => (
                      <option key={letter} value={letter}>
                        {letter}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button className="w-full px-4 py-2 bg-background border border-border rounded hover:border-accent/50 hover:bg-accent/10 transition text-sm text-foreground">
                選擇字體
              </button>
            </div>

            {/* Material Selection */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="font-display text-lg text-foreground">材質</h3>

              <div className="space-y-2">
                {["925 銀", "黃銅"].map((mat) => (
                  <label key={mat} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="material"
                      value={mat}
                      checked={material === mat}
                      onChange={() => handleMaterialChange(mat)}
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-sm text-foreground">{mat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Plating Selection */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="font-display text-lg text-foreground">表面電鍍</h3>

              <div className="space-y-2">
                {["無", "18K 金", "18K 白K金", "18K 玫瑰金"].map((plat) => (
                  <label key={plat} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="plating"
                      value={plat}
                      checked={plating === plat}
                      onChange={() => handlePlatingChange(plat)}
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-sm text-foreground">{plat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Finish Selection */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="font-display text-lg text-foreground">表面質地</h3>

              <div className="space-y-2">
                {["亮面", "霧面"].map((fin) => (
                  <label key={fin} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="finish"
                      value={fin}
                      checked={finish === fin}
                      onChange={() => handleFinishChange(fin)}
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-sm text-foreground">{fin}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h3 className="font-display text-lg text-foreground">尺寸（高度）</h3>

              <div className="space-y-2">
                {["8 mm", "10 mm", "12 mm", "15 mm", "18 mm"].map((sz) => (
                  <label key={sz} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="size"
                      value={sz}
                      checked={size === sz}
                      onChange={() => handleSizeChange(sz)}
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-sm text-foreground">{sz}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 sticky bottom-8">
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base py-6">
              <ShoppingCart className="w-5 h-5 mr-2" />
              加入購物車
            </Button>
            <Button
              variant="outline"
              className="w-full border-accent/50 text-foreground hover:bg-accent/10 py-6"
            >
              <Save className="w-5 h-5 mr-2" />
              保存設計
            </Button>
            <Button
              variant="ghost"
              className="w-full text-accent hover:bg-accent/10 py-6"
            >
              💎 重新開始 AI 設計諮詢
            </Button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-border bg-card p-8 mt-12">
        <div className="container grid md:grid-cols-3 gap-8">
          <div>
            <h4 className="font-display text-foreground mb-2">製作時間</h4>
            <p className="text-foreground/70 text-sm">5-7 個工作天</p>
          </div>
          <div>
            <h4 className="font-display text-foreground mb-2">品質保證</h4>
            <p className="text-foreground/70 text-sm">一次免費修改 + 滿意度保證</p>
          </div>
          <div>
            <h4 className="font-display text-foreground mb-2">支援</h4>
            <p className="text-foreground/70 text-sm">hello@duet.brendonchen.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
