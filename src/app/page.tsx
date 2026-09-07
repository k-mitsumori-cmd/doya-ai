"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Check,
  Layers,
  MousePointer2,
} from "lucide-react";
import { LpShell, CtaBand, HowItWorks } from "@/components/lp";
import { ServiceDirectory } from "@/components/lp/renewal/Renewal";

export default function HomePage() {
  return (
    <LpShell
      serviceName="ドヤマーケAI"
      icon="workspaces"
      ctaHref="/#doya-services"
      ctaLabel="サービスを選ぶ"
      loginHref="/auth/signin"
    >
      <section className="doya-home-hero">
        <span className="doya-eyebrow">
          <Sparkles size={16} />
          あなたのチームに、AIという仲間を。
        </span>
        <h1>
          その仕事、
          <br />
          <em>ドヤくんとやってみよう。</em>
        </h1>
        <p>
          バナーも、記事も、商談準備も。
          <br />
          手が回らなかった仕事を、得意なAIと一緒に進められます。
        </p>
        <div className="doya-actions">
          <a href="#doya-services" className="doya-button">
            仕事に合うAIを見つける <ArrowRight size={20} />
          </a>
          <a href="#doya-resources" className="doya-button doya-secondary">
            3点セットを見る <ArrowRight size={18} />
          </a>
        </div>
        <div className="doya-home-team">
          <Image
            src="/renewal/bear-teamwork.webp"
            alt="制作・営業・チームの仕事を手伝うドヤくんたち"
            width={660}
            height={440}
            priority
            sizes="(max-width: 760px) 390px, 660px"
          />
          <span className="doya-role-badge">つくる仕事、お手伝いします。</span>
          <span className="doya-role-badge">商談の準備、お任せください。</span>
          <span className="doya-role-badge">チームの仕事を、ひとつに。</span>
        </div>
      </section>
      <div className="doya-value-strip">
        <span>
          <Check size={18} />
          無料プランからスタート
        </span>
        <span>
          <Layers size={18} />
          1つのアカウントで利用
        </span>
        <span>
          <MousePointer2 size={18} />
          必要な業務から選択
        </span>
      </div>
      <ServiceDirectory />
      <section className="doya-home-use">
        <div className="doya-section-inner">
          <span className="doya-eyebrow">A DAY WITH DOYA</span>
          <h2>仕事の流れに、\n得意なAIをひとつずつ。</h2>
          <p>
            たとえば、新しいサービスを広めたい日。
            <br />
            それぞれの成果物を確認しながら、次の仕事へつなげられます。
          </p>
          <div className="doya-journey">
            {[
              {
                id: "persona",
                name: "誰に届ける？",
                desc: "URLから顧客像と訴求を整理。",
              },
              {
                id: "banner",
                name: "どう伝える？",
                desc: "訴求に合わせたバナー案を作成。",
              },
              {
                id: "doyaslide",
                name: "どう提案する？",
                desc: "伝えたい内容を資料にまとめます。",
              },
            ].map((s, i) => (
              <Link key={s.id} href={`/${s.id}`}>
                <span>0{i + 1}</span>
                <Image
                  src={`/renewal/icons/${s.id}.webp`}
                  alt=""
                  width={60}
                  height={60}
                />
                <h3>{s.name}</h3>
                <p>{s.desc}</p>
                <b>
                  サービスを見る <ArrowRight size={17} />
                </b>
              </Link>
            ))}
          </div>
          <p className="doya-journey-note">
            サービス間の受け渡しは、ご自身で内容を確認して行います。
          </p>
        </div>
      </section>
      <HowItWorks
        title="まずは、ひとつの仕事から。"
        steps={[
          {
            icon: "edit",
            title: "やりたい仕事を選ぶ",
            desc: "制作・マーケティング、営業、人事・業務管理から、ご自身の課題に合うサービスを選びます。",
          },
          {
            icon: "play_arrow",
            title: "必要な情報を入力する",
            desc: "URLや素材など、各サービスに必要な情報を用意します。画面の案内に沿って進められます。",
          },
          {
            icon: "check",
            title: "結果を確認して活用する",
            desc: "AIの提案や集計内容をご自身で確認します。必要に応じて編集・修正し、実際の業務にご活用ください。",
          },
        ]}
      />
      <CtaBand
        title={
          <>
            今日の仕事を、
            <br />
            少し楽しみに。
          </>
        }
        subtitle="気になったサービスを、無料プランからお試しください。"
        ctaHref="/#doya-services"
        ctaLabel="自分に合うAIを探す"
      />
    </LpShell>
  );
}
