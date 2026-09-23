import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/Users/mitsumori_katsuki/Code/09_Cursol';
const sourceRoot = path.join(repoRoot, 'reference/generated-assets/2026-08-23-banner-template-refresh-v2');
const outputRoot = path.join(repoRoot, 'reference/generated-assets/2026-08-31-doya-banner-candidates-100');
const source = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'generation-requests.json'), 'utf8'));

const genres = [
  {
    slug: 'beauty-cosme', genre: '美容・コスメ', industry: '美容・コスメ', category: 'beauty', count: 7,
    items: [
      ['朝の肌に、透明感。', 'うるおい続く美容液', '朝露をまとった透明な美容液ボトル、白い石と柔らかな窓光'],
      ['素肌、今日もごきげん。', '敏感肌のための保湿ケア', '自然光の洗面台、素肌の東アジア系女性とクリームの質感'],
      ['毛穴まで、澄みわたる。', '泡で包むクレイ洗顔', 'きめ細かな泡と灰白色クレイ、清涼感のある水面'],
      ['ひと塗り、春めく。', '透け感リップ新色', 'コーラル色のリップと大胆な一筆のスウォッチ'],
      ['夜は、肌を休ませる。', '眠っている間の集中ケア', '深い藍色の背景、月光を受ける美容クリーム'],
      ['植物のちからを一滴。', '国産ハーブの美容オイル', '押し花と琥珀色オイル、手漉き紙のテクスチャ'],
      ['60秒、肌リセット。', '集中保湿シート7枚', '透明ジェルのシートマスクと小さな砂時計、氷のような光'],
    ],
  },
  {
    slug: 'fashion-apparel', genre: 'ファッション・アパレル', industry: 'ファッション・アパレル', category: 'ec', count: 7,
    items: [
      ['新しい私、着てみる。', '春の軽やかコレクション', '風になびく淡色コートを着た東アジア系モデル、都市の朝'],
      ['週末だけ、特別価格。', '対象アイテム30%OFF', '白背景に整然と並ぶシャツとバッグ、赤い値札のアクセント'],
      ['一枚で、きちんと見え。', '働く日のセットアップ', 'オフィス街を歩く東アジア系女性、ネイビーのセットアップ'],
      ['夏色を、先取り。', '新作トップス入荷', '鮮やかなブルーとライムの服を切り抜きでリズミカルに配置'],
      ['着回しは、もっと自由。', '7日間コーデ提案', '一人の東アジア系モデルと7着の小さなコーデシルエット'],
      ['素材で選ぶ、心地よさ。', '国産リネンの新定番', '生成りリネン生地の接写と木製ハンガー、自然光'],
      ['今日の主役は、この靴。', '軽量スニーカー新登場', '動きのあるスニーカーの俯瞰写真、幾何学的な影'],
    ],
  },
  {
    slug: 'food-beverage', genre: '飲料・食品', industry: '飲料', category: 'ec', count: 7,
    items: [
      ['ひと口で、夏になる。', '瀬戸内レモンソーダ', '氷とレモンが弾ける透明グラス、強い夏の日差し'],
      ['朝を、ちゃんと食べよう。', '焼きたてパンの定期便', '木のテーブルに焼きたてパンと湯気、生活感ある朝食'],
      ['深煎り、香り立つ。', '焙煎士が選ぶ季節の豆', 'コーヒー豆と黒いカップ、斜めから差す暖かな光'],
      ['ごほうびは、濃厚。', '生チョコサンド限定販売', '割ったチョコサンドの断面、深いブラウンと金色'],
      ['野菜を、もっと手軽に。', '1日分のグリーンスープ', '緑のポタージュと新鮮な野菜、爽やかな白背景'],
      ['できたてを、食卓へ。', '冷凍惣菜10品おためし', '複数の和惣菜を小鉢に盛った俯瞰、家庭的な木目'],
      ['夜ふかしの、相棒。', '低糖質スナック新発売', '紺色の夜景背景と紙袋入りスナック、遊び心ある照明'],
    ],
  },
  {
    slug: 'ec-sale', genre: 'EC・セール', industry: 'EC・セール', category: 'ec', count: 7,
    items: [
      ['今だけ、まとめてお得。', '3点購入で20%OFF', '衣類と生活雑貨を大胆な切り抜きで重ねたセール構成'],
      ['送料無料、今夜まで。', '24時間限定キャンペーン', '大きな数字と配送箱、赤と黄色の強いコントラスト'],
      ['ポイント、5倍。', '週末のお買い物応援', 'コインと買い物袋のフラットイラスト、明るい青背景'],
      ['欲しかったもの、半額。', '在庫限りの特別セール', '商品写真をグリッド配置し中央に大きな半額訴求'],
      ['新生活を、かしこく。', '家具・家電セット特集', '明るいワンルームと家具家電、価格札を最小限に配置'],
      ['毎月届く、ちいさな幸せ。', '初月50%OFF', '定期便ボックスから雑貨が飛び出す明るい写真表現'],
      ['迷ったら、人気順。', '売れ筋ランキング公開中', '1位から3位の商品を表彰台風に並べた編集デザイン'],
    ],
  },
  {
    slug: 'health-fitness', genre: '健康・フィットネス', industry: 'スポーツ・フィットネス', category: 'beauty', count: 7,
    items: [
      ['今日から、動ける体へ。', '初回トレーニング無料', '明るいジムでフォームを確認する東アジア系トレーナーと利用者'],
      ['30分で、汗をかこう。', '忙しい人の時短ジム', '時計の円形モチーフと躍動するランナー、黒と黄'],
      ['続くから、変わっていく。', 'オンライン運動習慣', '自宅でタブレットを見ながらストレッチする東アジア系女性'],
      ['姿勢から、軽やかに。', '体験ピラティス受付中', '自然光のスタジオでリフォーマーを使う女性'],
      ['走る朝が、好きになる。', '初心者ランニング講座', '朝焼けの川沿いを走る少人数グループ'],
      ['食べて、整える。', '管理栄養士の食事サポート', '彩り豊かなプレートと手書きの栄養メモ'],
      ['本気の2か月。', '専属コーチと目標達成', '力強いタイポグラフィとトレーニング中の男性のシルエット'],
    ],
  },
  {
    slug: 'medical-healthcare', genre: '医療・ヘルスケア', industry: '医療・ヘルスケア', category: 'beauty', count: 7,
    items: [
      ['つらい時は、話していい。', 'オンライン心療相談', '落ち着いた室内で画面越しに相談する東アジア系女性'],
      ['通院を、もっと身近に。', 'スマホでオンライン診療', 'スマートフォンと医師の清潔な診察風景、白と水色'],
      ['健診結果、そのままにしない。', '専門医がわかりやすく解説', '健診票とタブレットを囲む医師と患者の手元'],
      ['眠りの悩み、相談できます。', '睡眠外来の初回予約', '夜明け前の寝室と穏やかなブルーグラデーション'],
      ['歯の健康を、今日から。', '土日も診療・駅から3分', '清潔な歯科空間と自然な笑顔の東アジア系人物'],
      ['頭痛を、我慢しない。', '専門外来で原因を確認', '頭部の輪郭とやさしい線画、安心感ある緑と白'],
      ['家族の健康、ひとつのアプリで。', '服薬と通院予定をまとめて管理', '家族三世代の自然な生活写真と整理された予定カード'],
    ],
  },
  {
    slug: 'it-saas', genre: 'IT・SaaS', industry: 'ビジネス・SaaS', category: 'it', count: 7,
    items: [
      ['営業資料、すぐ見つかる。', 'チームの情報を一か所に', 'デスク上の資料と整理された検索画面を組み合わせた実務的構成'],
      ['見積作成、5分で完了。', '入力ミスも自動でチェック', '見積書の紙面とノートPC、青い数字を大きく配置'],
      ['顧客対応を、止めない。', '問い合わせを自動振り分け', 'サポート担当者と整理された会話フローの図形表現'],
      ['会議の要点、もう漏らさない。', '議事録を自動で整理', '会議中の東アジア系チームと要点カードの控えめな合成'],
      ['数字でわかる、次の一手。', '経営データを一画面に', '青いカードを手で並べる俯瞰写真、ダッシュボードの比喩'],
      ['契約更新を、見逃さない。', '期限と担当者を自動通知', '赤い革の手帳とカレンダー、上質な静物写真'],
      ['経費申請、スマホで完結。', '承認まで最短1分', 'レシートとスマートフォン、黄と紺の大胆な編集デザイン'],
    ],
  },
  {
    slug: 'it-technology', genre: 'IT・テクノロジー', industry: 'IT・テクノロジー', category: 'it', count: 7,
    items: [
      ['AI導入、まずは小さく。', '業務に合わせた実証支援', '少人数の東アジア系開発チームと抽象的な光のネットワーク'],
      ['開発速度を、次の水準へ。', 'クラウド移行を伴走支援', 'コード画面の反射とエンジニアの横顔、深い青'],
      ['守るべきデータを、守り抜く。', '24時間セキュリティ監視', '暗いサーバールームと鋭い赤の一本線'],
      ['現場のDX、止まっていませんか。', '業務設計から実装まで', '工場現場とタブレットを使う技術者、黄の注意色'],
      ['データ連携を、もっと軽く。', 'API統合を短期間で実現', '複数の箱が一本の流れにつながる立体的な図形'],
      ['その検証、仮想空間で。', 'デジタルツイン開発支援', '製造設備の実写と線画モデルを半分ずつ重ねた表現'],
      ['カメラが、異常を見つける。', '画像認識で検品を自動化', '生産ラインの製品と解析枠、緑の判定サイン'],
    ],
  },
  {
    slug: 'education-seminar', genre: '教育・セミナー', industry: '教育・学習・セミナー', category: 'it', count: 7,
    items: [
      ['学び直しを、今日から。', '無料キャリア講座開催', 'ノートPCで学ぶ東アジア系社会人、夕方の落ち着いた部屋'],
      ['伝わる資料のつくり方。', '90分オンラインセミナー', 'スライドを指差す講師と大きな紙面モチーフ'],
      ['英語を、話す習慣へ。', '毎朝15分のオンライン英会話', '朝のキッチンで画面越しに話す東アジア系人物'],
      ['資格で、未来をひらく。', '合格まで伴走サポート', '参考書と合格ラインを表す上向きの図形、青と橙'],
      ['子どもの好奇心を育てる。', '週末プログラミング教室', 'ロボットを組み立てる東アジア系の子どもたち'],
      ['数字に強いチームをつくる。', 'データ分析研修', '付箋とグラフを囲むビジネスチームの俯瞰'],
      ['新任リーダーの教科書。', '実践型マネジメント講座', '一冊のノートと力強いタイポグラフィ、深緑と白'],
    ],
  },
  {
    slug: 'recruit-career', genre: '採用・転職', industry: '転職・採用・人材', category: 'recruit', count: 7,
    items: [
      ['次の挑戦を、ここから。', 'プロダクトチーム採用中', 'オフィスで議論する多様な東アジア系メンバー'],
      ['経験より、好奇心。', '未経験エンジニア募集', '新しいPCを開く若手社員と先輩の自然な交流'],
      ['暮らす街で、働こう。', '地域限定スタッフ募集', '商店街で働く人々と町の風景、温かな写真'],
      ['そのスキル、もっと活かせる。', '専門職の転職相談', '落ち着いた面談室で話すキャリア相談員と求職者'],
      ['未来をつくる仲間へ。', '新卒オンライン説明会', '複数の若手社員のポートレートを編集的に配置'],
      ['仕事も、暮らしも、自分らしく。', '週4勤務の選択肢', '自然光の自宅とオフィスを二分割した構図'],
      ['チームの数だけ、成長がある。', '社員インタビュー公開中', '3人の社員の表情と短い引用を想起させる紙片、文字は指定文のみ'],
    ],
  },
  {
    slug: 'realestate-housing', genre: '不動産・住宅', industry: '住宅・不動産', category: 'ec', count: 6,
    items: [
      ['光のある家に、住もう。', '週末モデルルーム公開', '大きな窓と木の質感がある明るいリビング'],
      ['駅近で、暮らしに余白。', '新築マンション資料請求', '都市の駅とマンション外観を洗練された分割構図で'],
      ['家賃を、見直すきっかけ。', '住み替え相談は無料', '家計ノートと鍵、相談する東アジア系カップルの手元'],
      ['海のそばで、働き暮らす。', '移住向け賃貸特集', '海が見えるワークスペースと開いた窓'],
      ['平屋という、ちょうどよさ。', '実例見学会を開催', '庭とつながる木造平屋、夕方の柔らかな光'],
      ['土地探しから、一緒に。', '希望エリアを無料診断', '地図と土地模型を囲む設計士と家族の俯瞰'],
    ],
  },
  {
    slug: 'finance-insurance', genre: '金融・保険', industry: '金融・保険', category: 'it', count: 6,
    items: [
      ['将来のお金、見える化。', '家計シミュレーション無料', '家計ノートと透明な積み木グラフ、安心感ある青緑'],
      ['もしもの備えを、今のうちに。', '保険をまとめて比較', '家族写真と傘の抽象表現、白い余白を広く取る'],
      ['投資を、もっとわかりやすく。', '初心者向け無料セミナー', 'コインとゆるやかな上昇線、信頼感ある紺と黄'],
      ['口座開設、スマホで完了。', '最短5分で手続き', 'スマートフォンと本人確認書類の手元、明るい背景'],
      ['会社のお金を、ひとつに。', '法人支出をリアルタイム管理', '複数のカードと明細を整理した俯瞰、深緑と白'],
      ['老後の不安を、相談に変える。', '専門家への初回相談無料', '落ち着いた窓辺で話すシニア夫婦と相談員'],
    ],
  },
  {
    slug: 'travel-tourism', genre: '旅行・観光', industry: '旅行・観光', category: 'ec', count: 6,
    items: [
      ['週末は、島時間。', '往復フェリー付き宿泊プラン', '青い海と小さな港、島の宿を望む広角写真'],
      ['まだ知らない京都へ。', '朝だけのまち歩きツアー', '早朝の石畳と静かな路地を歩く少人数の旅行者'],
      ['星の下で、眠ろう。', '高原グランピング早割', '星空と温かなテント、焚き火のある夜'],
      ['雪景色を、貸し切ろう。', '平日限定の温泉旅', '雪見露天風呂と湯気、静かな白と藍'],
      ['食べるために、旅に出る。', '港町の味覚めぐり', '海鮮料理と市場の活気をコラージュした構図'],
      ['親子で、夏の大冒険。', '森の体験プログラム', '森で観察ノートを持つ東アジア系の親子'],
    ],
  },
  {
    slug: 'event-media', genre: 'イベント・メディア', industry: 'イベント・メディア', category: 'ec', count: 6,
    items: [
      ['音が、街をつなぐ。', '野外音楽祭チケット発売', '夕暮れの都市型フェスと光の筋、大胆なタイポグラフィ'],
      ['未来を語る2日間。', 'ビジネスカンファレンス', '登壇者のシルエットと幾何学形状、知的な青紫'],
      ['本と出会う、週末。', '独立書店フェア開催', '本が積まれた会場と手書き風の赤いアクセント'],
      ['つくる人に、会いに行く。', 'クラフトマーケット', '陶器と布小物、作り手の手元を温かな写真で'],
      ['笑って、夜を越えよう。', 'コメディライブ開催', 'スポットライトとマイク、黄色と黒のポスター調'],
      ['次の一本が、ここにある。', '短編映画祭2026', '映写機の光と複数のフレーム、映画ポスター風'],
    ],
  },
  {
    slug: 'lifestyle-pet', genre: '暮らし・ペット', industry: 'ライフスタイル・暮らし ／ ペット・動物', category: 'ec', count: 6,
    items: [
      ['朝の家事を、半分に。', '時短家電レンタル', '明るいキッチンと小型家電、生活感ある自然光'],
      ['香りで、部屋を整える。', '季節のアロマ定期便', '小さな香り瓶と植物、静かなベージュの空間'],
      ['うちの子に、ちょうどいい。', '年齢別ドッグフード', '元気な小型犬と粒の大きさが分かるフードボウル'],
      ['猫との時間を、もっと長く。', '自動トイレお試し30日', '清潔な室内とくつろぐ猫、製品を自然に見せる'],
      ['捨てない暮らし、はじめよう。', '量り売り日用品セット', '再利用ボトルと日用品、クラフト紙と緑の配色'],
      ['家族の写真を、毎月一冊。', 'フォトブック初回無料', '家族写真のアルバムをめくる手元、柔らかな午後光'],
    ],
  },
];

const styleVariants = [
  'editorial commercial photography with restrained Japanese typography and tactile print grain',
  'clean Japanese campaign design with a strong crop, crisp hierarchy, and two-color accent system',
  'bold magazine-ad composition with asymmetrical type, layered cutouts, and deliberate negative space',
  'warm documentary advertising photography with believable materials, skin, and natural light',
  'graphic-led Japanese banner with flat shapes, a single photographic anchor, and confident typography',
  'premium minimal advertising art direction with refined serif and sans-serif contrast',
  'friendly contemporary Japanese retail design with hand-drawn accents and energetic spacing',
];

const outputRequests = [];
let globalIndex = 1;

for (const genre of genres) {
  const sourceRequests = source.requests.filter((request) => request.genreSlug === genre.slug);
  if (sourceRequests.length < genre.count) throw new Error(`Not enough source references for ${genre.slug}`);

  for (let index = 0; index < genre.count; index += 1) {
    const [headline, sub, concept] = genre.items[index];
    const sourceRequest = sourceRequests[index];
    const id = `doya100-${genre.slug}-${String(index + 1).padStart(2, '0')}`;
    const sourceReferencePath = path.join(sourceRoot, sourceRequest.reference.imagePath);
    const referencePath = path.relative(outputRoot, sourceReferencePath);
    const prompt = [
      'Use case: ads-marketing',
      'Asset type: Japanese web display banner for the Doya Banner AI candidate library, landscape 1.91:1',
      `Primary request: Create a completely original ${genre.genre} campaign banner. Use the supplied reference image only for general composition logic, typography hierarchy, spacing, crop, and Japanese advertising density. Do not reproduce its brand, logo, people, product, wording, illustration, or exact arrangement.`,
      'Input image: Image 1 is a style and composition reference only.',
      `Scene/backdrop: ${concept}`,
      `Style/medium: ${styleVariants[index % styleVariants.length]}`,
      'Composition/framing: Wide 1.91:1 final banner. Keep all essential subjects and every character of copy inside generous safe margins. Use a distinct composition, not a generic left-copy/right-stock-person template.',
      'Text (verbatim):',
      `"${headline}"`,
      `"${sub}"`,
      'Typography: Render each quoted Japanese phrase exactly once and fully legibly, with strong size contrast and natural Japanese optical spacing. No other text.',
      'Color palette: Limit the design to one main color, one support color, and one accent color appropriate to the scene.',
      'Constraints: the complete final banner must be a single generated raster image; all text is baked into the artwork; East Asian people only when people appear; original unbranded concept; believable anatomy, hands, materials, light, and shadows; no trademarks; no recognizable public figures; no watermark.',
      'Avoid: gibberish, misspelled Japanese, duplicated characters, extra words, fake logos, fake app UI, floating dashboard cards, rounded CTA pills, neon gradient blobs, glossy generic 3D icons, porcelain stock-model faces, over-centered symmetry, copying the reference literally.',
    ].join('\n');

    outputRequests.push({
      index: globalIndex,
      templateId: id,
      genre: genre.genre,
      genreSlug: genre.slug,
      industry: genre.industry,
      category: genre.category,
      status: 'pending',
      prompt,
      copy: { headline, sub },
      concept,
      reference: {
        sourceUrl: sourceRequest.reference.url,
        title: sourceRequest.reference.title,
        imagePath: referencePath,
        absoluteImagePath: sourceReferencePath,
      },
      output: {
        rawPath: `raw/${id}.png`,
        imagePath: `images/${id}.webp`,
        width: 1200,
        height: 628,
        format: 'webp',
      },
    });
    globalIndex += 1;
  }
}

if (outputRequests.length !== 100) throw new Error(`Expected 100 requests, got ${outputRequests.length}`);

fs.mkdirSync(path.join(outputRoot, 'raw'), { recursive: true });
fs.mkdirSync(path.join(outputRoot, 'images'), { recursive: true });
fs.mkdirSync(path.join(outputRoot, 'contact-sheets'), { recursive: true });
fs.mkdirSync(path.join(outputRoot, 'qa'), { recursive: true });
fs.writeFileSync(path.join(outputRoot, 'generation-requests.json'), `${JSON.stringify({
  version: 1,
  createdAt: new Date().toISOString(),
  generationMode: 'Codex built-in image generation; one call per asset',
  sourceLibrary: path.relative(outputRoot, sourceRoot),
  total: outputRequests.length,
  completed: 0,
  pending: outputRequests.length,
  requests: outputRequests,
}, null, 2)}\n`);

const references = ['# ドヤバナーAI 新規候補100枚 参照記録', '', '各画像はBANNER LIBRARY由来の既存収集画像を、構図・文字階層・余白・密度の参考にのみ使用する。ブランド、ロゴ、商品名、人物、コピー、正確な配置は流用しない。', ''];
for (const genre of genres) {
  references.push(`## ${genre.genre}`, '');
  for (const request of outputRequests.filter((item) => item.genreSlug === genre.slug)) {
    references.push(`- ${request.templateId}: ${request.reference.sourceUrl} — ${request.reference.title}`);
  }
  references.push('');
}
fs.writeFileSync(path.join(outputRoot, 'references.md'), `${references.join('\n')}\n`);

console.log(JSON.stringify({ outputRoot, total: outputRequests.length, byGenre: Object.fromEntries(genres.map((genre) => [genre.slug, genre.count])) }, null, 2));
