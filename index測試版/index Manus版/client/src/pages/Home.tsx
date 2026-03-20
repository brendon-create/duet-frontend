import { Button } from "@/components/ui/button";
import { ChevronDown, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * DUET Home Page - Luxury Jewelry Brand
 * Design Philosophy: Craftsmanship + Elegance + Personalization
 * 
 * Visual Language:
 * - Deep Gray-Blue background (oklch(0.15 0.02 260))
 * - Ivory White text (oklch(0.95 0.005 65))
 * - Antique Bronze accents (oklch(0.65 0.15 65))
 * - Playfair Display for headings (serif, elegant)
 * - Noto Serif TC for body (readable, refined)
 */

export default function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-20">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
              <span className="font-display text-lg text-accent-foreground">D</span>
            </div>
            <span className="font-display text-xl text-foreground">DUET</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#process" className="text-sm hover:text-accent transition">
              如何運作
            </a>
            <a href="#stories" className="text-sm hover:text-accent transition">
              客戶故事
            </a>
            <a href="#faq" className="text-sm hover:text-accent transition">
              常見問題
            </a>
          </div>

          <a href="/design-studio">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
              開始設計
            </Button>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663150768356/Lju6oXg3LPf2LvirVU2wDk/duet-hero-background-6s7pwGftU3245C8p8AHNNR.webp')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            transform: `translateY(${scrollY * 0.5}px)`,
          }}
        />

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/40 z-10" />

        {/* Content */}
        <div className="container relative z-20 max-w-2xl">
          <div className="space-y-6 animate-fade-in">
            <div className="inline-block px-4 py-2 bg-accent/20 border border-accent/40 rounded-full">
              <span className="text-accent text-sm font-medium">✨ 客製化珠寶設計</span>
            </div>

            <h1 className="font-display text-6xl md:text-7xl leading-tight text-foreground">
              每一個交織，都是一段故事的開始
            </h1>

            <p className="text-lg text-foreground/80 max-w-xl leading-relaxed">
              透過 AI 對話，與我們的設計師一起創作獨一無二的珠寶。每件作品都承載著您的故事，經過精湛的手工製作，成為永恆的交織。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <a href="/design-studio">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-base">
                開始你的故事
              </Button>
            </a>
              <Button
                size="lg"
                variant="outline"
                className="border-accent/50 text-foreground hover:bg-accent/10"
              >
                了解更多
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 animate-bounce">
          <ChevronDown className="w-6 h-6 text-accent" />
        </div>
      </section>

      {/* Brand Story Section */}
      <section className="py-24 bg-background border-t border-border">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="font-display text-5xl leading-tight text-foreground">
                工藝與故事的交織
              </h2>
              <p className="text-foreground/80 leading-relaxed">
                DUET 不只是珠寶，而是您故事的物質化表現。我們相信每一件珠寶都應該獨一無二，就像每個人的故事一樣。
              </p>
              <p className="text-foreground/80 leading-relaxed">
                透過結合 AI 設計諮詢和傳統金工工藝，我們幫助您將想像轉化為現實。從材質選擇到細節打磨，每一步都是對工藝精神的致敬。
              </p>

              <div className="pt-4 space-y-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-foreground">AI 設計諮詢</h3>
                    <p className="text-sm text-foreground/70">與 AI 對話，探索無限的設計可能</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-foreground">手工製作</h3>
                    <p className="text-sm text-foreground/70">由經驗豐富的工匠精心打造</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative h-96 md:h-full">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663150768356/Lju6oXg3LPf2LvirVU2wDk/duet-craft-detail-LVK8JVijVQM2n8Hn53Y6qU.webp"
                alt="Jewelry Craftsmanship"
                className="w-full h-full object-cover rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-24 bg-card border-t border-border">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-5xl text-foreground mb-4">您的設計旅程</h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">
              從初步想法到完成的珠寶，我們的流程確保每一步都充滿創意和品質
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "AI 對話",
                description: "與 AI 設計師討論您的想法和靈感",
              },
              {
                step: "2",
                title: "3D 設計",
                description: "在虛擬工作室中實時預覽您的設計",
              },
              {
                step: "3",
                title: "手工製作",
                description: "我們的工匠將您的設計變成現實",
              },
              {
                step: "4",
                title: "完成交付",
                description: "收到您獨一無二的珠寶作品",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="group relative p-8 bg-background border border-border rounded-lg hover:border-accent/50 transition"
              >
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center font-display text-xl font-bold">
                  {item.step}
                </div>

                <div className="pt-8 space-y-3">
                  <h3 className="font-display text-xl text-foreground">{item.title}</h3>
                  <p className="text-foreground/70 text-sm">{item.description}</p>
                </div>

                {idx < 3 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-accent/20 border border-accent/40 rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Stories Section */}
      <section id="stories" className="py-24 bg-background border-t border-border">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="font-display text-5xl text-foreground mb-4">客戶故事</h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">
              每一件 DUET 珠寶都承載著一個獨特的故事
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "林小姐",
                story: "我用 DUET 設計了一條項鍊來紀念我和伴侶的相識。每次看到它，都會想起那個特別的時刻。",
                image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663150768356/Lju6oXg3LPf2LvirVU2wDk/duet-materials-showcase-9gp4H86aRR7kZtWfz2zLVQ.webp",
              },
              {
                name: "王先生",
                story: "作為一個設計師，我很欣賞 DUET 將 AI 和手工藝結合的方式。最終的作品超出了我的期望。",
                image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663150768356/Lju6oXg3LPf2LvirVU2wDk/duet-materials-showcase-9gp4H86aRR7kZtWfz2zLVQ.webp",
              },
              {
                name: "陳女士",
                story: "我為女兒設計了一對耳環。她說這是她收過最有意義的禮物，因為它代表了我們之間的連結。",
                image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663150768356/Lju6oXg3LPf2LvirVU2wDk/duet-materials-showcase-9gp4H86aRR7kZtWfz2zLVQ.webp",
              },
            ].map((story, idx) => (
              <div
                key={idx}
                className="group p-8 bg-card border border-border rounded-lg hover:border-accent/50 transition space-y-4"
              >
                <div className="h-48 bg-background rounded-lg overflow-hidden">
                  <img
                    src={story.image}
                    alt={story.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </div>
                <div>
                  <p className="text-foreground/80 italic mb-4">"{story.story}"</p>
                  <p className="font-display text-accent">{story.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-card border-t border-border">
        <div className="container max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-5xl text-foreground mb-4">常見問題</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "製作需要多久時間？",
                a: "從設計確認到完成交付，通常需要 5-7 個工作天。複雜設計可能需要更長時間。",
              },
              {
                q: "可以選擇什麼材質？",
                a: "我們提供 925 銀和黃銅作為基礎材質，並支持 18K 金、18K 白K金和 18K 玫瑰金電鍍。",
              },
              {
                q: "如果不滿意設計怎麼辦？",
                a: "我們提供一次免費的設計修改機會。如果您仍不滿意，可以申請全額退款。",
              },
              {
                q: "AI 對話會保存我的隱私嗎？",
                a: "是的，我們採用行業領先的加密技術保護您的隱私。所有對話記錄都是私密的。",
              },
              {
                q: "可以只訂購一個字母嗎？",
                a: "當然可以。DUET 支援 1-2 個字母的客製化設計。",
              },
            ].map((item, idx) => (
              <details
                key={idx}
                className="group p-6 bg-background border border-border rounded-lg hover:border-accent/50 transition cursor-pointer"
              >
                <summary className="flex items-center justify-between font-display text-lg text-foreground">
                  {item.q}
                  <ChevronDown className="w-5 h-5 text-accent group-open:rotate-180 transition" />
                </summary>
                <p className="mt-4 text-foreground/70 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-background border-t border-border">
        <div className="container text-center space-y-8">
          <h2 className="font-display text-5xl text-foreground">準備好開始了嗎？</h2>
          <p className="text-foreground/70 max-w-2xl mx-auto text-lg">
            讓我們一起創作您的故事。每一個交織，都是永恆的開始。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <a href="/design-studio">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-base">
                立即開始設計
              </Button>
            </a>
            <Button
              size="lg"
              variant="outline"
              className="border-accent/50 text-foreground hover:bg-accent/10"
            >
              聯絡我們
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-display text-foreground mb-4">DUET</h3>
              <p className="text-foreground/70 text-sm">為你的故事，鑄造永恆的交織</p>
            </div>
            <div>
              <h4 className="font-display text-foreground mb-4">產品</h4>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <a href="#" className="hover:text-accent transition">
                    開始設計
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition">
                    訂單查詢
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition">
                    保固服務
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-foreground mb-4">公司</h4>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <a href="#" className="hover:text-accent transition">
                    如何運作
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition">
                    客戶故事
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition">
                    常見問題
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-foreground mb-4">聯絡</h4>
              <p className="text-sm text-foreground/70">hello@duet.brendonchen.com</p>
              <div className="flex gap-4 mt-4">
                <a href="#" className="text-accent hover:text-accent/80 transition">
                  Instagram
                </a>
                <a href="#" className="text-accent hover:text-accent/80 transition">
                  Facebook
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-foreground/70">
            <p>&copy; 2026 DUET by BCAG. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-accent transition">
                隱私權政策
              </a>
              <a href="#" className="hover:text-accent transition">
                使用條款
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
