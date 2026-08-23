import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'reference/generated-assets/2026-08-23-banner-template-refresh');
const targetRoot = path.join(projectRoot, 'reference/generated-assets/2026-08-23-banner-template-refresh-v2');
const prototypeRoot = path.join(projectRoot, 'reference/generated-assets/2026-08-23-banner-template-refresh-v2-prototypes');
const downloadedReferenceRoot = '/tmp/doya-banner-library-150/images';

const entries = (rows) => rows.map(([headline, subcopy, concept]) => ({ headline, subcopy, concept }));

const copySets = {
  'beauty-cosme': entries([
    ['肌に、静かな光を。', '発酵由来の濃密美容液', '朝の斜光、気泡を含む琥珀色美容液、擦れた乳白ガラス、石の台座。'],
    ['夕方まで、素肌のまま。', 'うるおい下地 SPF35', 'メイク前の生活感ある洗面台、薄いクリームの指跡、自然な肌の接写。'],
    ['毛穴に、風が通る。', '夏のジェル洗顔', '半透明ジェル、水滴、濡れた白磁、強い余白を使った清涼な商品写真。'],
    ['唇に、体温の赤。', '透けるリップカラー', '赤い顔料の刷毛跡、一本の口紅、唇の部分写真を使うエディトリアル構成。'],
    ['森から届く、保湿。', '国産ハーブの保湿クリーム', '押し花、薬草標本、素朴なガラス瓶、植物図鑑の紙質を感じる静物。'],
    ['60秒、肌を休ませる。', '集中保湿シート 7枚入', '冷えたシートマスクとアルミ袋、タイマー数字を主役にした実用的な広告。'],
    ['はじめての一滴を、半額で。', '定期縛りなし・送料無料', '大胆な価格作字と小さな商品、赤と生成りの二色刷りキャンペーン。'],
    ['夜を味方にする。', '睡眠中の集中ケア', '深い紺の寝室光、黒いスポイト瓶、月の反射だけを使う静かな高級広告。'],
    ['肌の現在地を知る。', '3分オンライン肌診断', '顔の接写ではなく鏡、手書きの測定メモ、診断チャートを編集的に配置。'],
    ['手のひらサイズの、春。', '限定ミニコスメセット', '小さなコスメを花びらと包装紙の上に並べた、贈り物らしい俯瞰写真。'],
  ]),
  'fashion-apparel': entries([
    ['夏服は、風から選ぶ。', '天然素材の新作', '屋上の物干しと風に揺れる服、人物を小さく置くファッション誌的な写真。'],
    ['軽やかに、街へ。', 'リネンコレクション', '朝の商店街を歩く一人の女性、逆光、服の皺と街の看板の生活感。'],
    ['今ほしい服、全部ここ。', '週末だけのスタイル編集', '服、靴、帽子を雑誌の切り抜きのように密集させた商品コラージュ。'],
    ['余白まで、私らしい。', '白いシャツの特集', '白い壁と一着のシャツ、縫い目と布の影を主役にした極端に静かな広告。'],
    ['ふたりで選ぶ、週末服。', 'リンクコーデ特集', '友人二人が古い喫茶店で服を比べる、会話中の自然なスナップ。'],
    ['似合うが、見つかる。', '4つのスタイル診断', '証明写真風ポートレート4点と色見本を組んだ診断ページ風デザイン。'],
    ['旅する服は、軽くなる。', 'しわになりにくい春アウター', '駅のベンチ、畳んだ薄手コート、切符、窓外の景色を使う旅の静物。'],
    ['つづく服を、選ぼう。', '長く着るための定番', '縫製工場の手元、補修跡、厚い生地の接写を使ったクラフトドキュメント。'],
    ['時を重ねる、腕もと。', '新作ウォッチ', '古い机、二本の腕時計、設計スケッチ、硬い横光のプロダクト写真。'],
    ['ボトムで、印象を変える。', '体型別スタイルガイド', '同じ壁の前に異なるボトム5体、人物全身を編集的な横並びにする。'],
  ]),
  'food-beverage': entries([
    ['香り立つ、夏カレー。', '2日間だけの限定皿', '黄色い紙面、二皿のカレー、スパイスの粉、日付を強く見せる食堂広告。'],
    ['夏は、うまい方へ。', '香ばし焼き鳥 × 柚子スパークリング', '中央の無銘ボトル、両側の友人、炭火焼き鳥、直射フラッシュの高密度キャンペーン。'],
    ['巨峰、ひと口の贅沢。', '季節限定フルーツソーダ', '濃紫の飲料と葡萄、夜のバーの照明、光る氷を使う官能的な静物。'],
    ['2枚目は、もっとおトク。', '平日半額・土日は送料無料', 'ピザ二枚と巨大な価格文字、折込チラシのような強い赤黄の広告。'],
    ['ふわり、塩ミルク。', '夏限定の冷たいスイーツ', '白いソフトクリームとシュー、薄青の陶器、涼しい窓光の菓子店写真。'],
    ['コーヒーに、透明感。', 'シトラス香る新ブレンド', '跳ねるアイスコーヒー、レモン皮、豆、茶色い活版文字を組む。'],
    ['ピザ時間、はじめよう。', '週末だけのセットメニュー', '友人の手、取り分け途中のピザ、テーブルの乱れ、緑の手描き帯。'],
    ['この夏、冷やして旨い。', '数量限定アイスコーヒー', '海辺の窓と二つのグラス、遠景を大きく残す静かな飲料広告。'],
    ['夜を、香ばしく。', '燻製ナッツとクラフトソーダ', '古い酒場の木卓、燻製の煙、オレンジの看板光、商品の接写。'],
    ['レモンが、弾ける。', '期間限定スパークリング', '氷、炭酸、輪切りレモンを強い逆光で止めた爽快な商品写真。'],
  ]),
  'ec-sale': entries([
    ['夏の大感謝市。', '人気アイテム 最大60%OFF', '旅行小物を紙の切り抜きで密集させ、青と黄色の量販チラシ感を磨く。'],
    ['48時間だけ、特別。', 'タイムセール開催中', '巨大な数字と時計、橙色の紙面、商品箱を少数だけ置く。'],
    ['まとめ買いで、もっと得。', '3点以上で送料無料', '黄色地、段ボール、無銘の日用品、黒い作字を使う機能的なEC広告。'],
    ['ポイント、今だけ5倍。', '会員限定キャンペーン', '硬貨の紙吹雪ではなく印刷された円形記号と買物袋を使うグラフィック。'],
    ['夏支度、まるごとおトク。', '季節アイテムを厳選', '扇子、帽子、水筒、サンダルを涼しい青の俯瞰写真で配置。'],
    ['欲しかった、が半額。', '人気アイテム一斉値下げ', '買物カートと大きな赤文字、人物は一人だけ自然な驚きを見せる。'],
    ['夏服、最終価格。', '最大60%OFF｜7.18–7.21', '再生紙に朱赤と黒だけを刷った写真なしの実験的な作字広告。'],
    ['10万円分、還元。', '抽選で100名さま', '黒と赤の抽選キャンペーン、数字を主役にして人物を小さく切り抜く。'],
    ['ゲーム祭、開幕。', '試遊作を期間限定価格で', '原色のコミック作字、架空ゲーム画面、会場の熱気を手作り感のある構成にする。'],
    ['春のわくわくクーポン。', '3,000円OFF 配布中', '淡いピンクのメモ紙、手描き店舗アイコン、実在感ある若い買物客。'],
  ]),
  'health-fitness': entries([
    ['続けたくなる、30分。', '初回体験 0円', '小さな街のジム、汗の残る器具、運動途中の女性を硬いスポーツ写真で捉える。'],
    ['仲間となら、動ける。', '入会特典キャンペーン', '屋外サーキットの三人、会話と息切れが見える自然な瞬間、青緑の作字。'],
    ['走る春、はじめよう。', '初心者向けランニング講座', '河川敷の早朝、ばらけたランナー、日付バッジを陸上大会風に組む。'],
    ['その一歩が、変えていく。', 'パーソナル体験受付中', '黒いスタジオ、トレーナーの手元、筋肉の緊張、赤白の硬いタイポ。'],
    ['今日が、自己ベスト。', '新規会員募集中', '一人の競技者を金色の横光で捉え、成績表の断片をエディトリアルに配置。'],
    ['燃やせ、あと10分。', '短時間HIITプログラム', '赤い床、汗、縄、ストップウォッチの数字を大きく見せる荒いスポーツ広告。'],
    ['姿勢から、軽くなる。', 'ピラティス初月50%OFF', '古いスタジオのマシン、姿勢の線図、生成りと黄色の実用広告。'],
    ['整えて、強くなる。', '食事サポートつきプラン', '弁当の俯瞰写真とトレーナーの実景を二分割し、青橙の情報帯を使う。'],
    ['外で、深呼吸しよう。', '週末ヨガクラス', '曇った海岸、風で揺れる服、少人数のヨガをモノクロに近い写真で。'],
    ['本気の2か月。', '結果に寄り添う個別指導', '同じ人物の過程を並べず、練習ノートとセッション写真で継続を伝える。'],
  ]),
  'medical-healthcare': entries([
    ['土曜も、診療しています。', '駅から徒歩3分の内科', '地域診療所の待合と医師の自然な応対、カレンダーを機能的に配置。'],
    ['健康相談、スマホで完結。', 'オンライン診療受付中', '実際の家庭の机、スマホ越しの医師、紫と白の控えめな情報設計。'],
    ['人間ドックを、もっと身近に。', '半日でできる総合健診', '黒と金ではなく深緑と生成り、問診の場面を落ち着いた誌面にする。'],
    ['花粉の季節、早めの対策。', 'アレルギー外来予約受付中', 'ティッシュ、窓辺の植物、淡い緑、症状を煽らない静かな医療広告。'],
    ['眠れない夜に、相談を。', '睡眠外来のオンライン相談', '夜の窓辺と一人の患者、青い小さなUIではなく会話の気配を写す。'],
    ['女性のための健診日。', '乳がん・子宮がん検診', '診察室の自然光、女性医師と患者、花の装飾を最小限にする。'],
    ['歯の健康、今日から。', '予防歯科の定期チェック', '歯ブラシと模型の実物写真、やわらかな幾何学面で親しみを出す。'],
    ['頭痛を、がまんしない。', '専門医に相談できます', '白赤の強い作字、頭部の簡潔な線画、患者を苦痛の演技で見せない。'],
    ['子どもの発熱、まず相談。', '夜間オンライン小児科', '家庭の夜、親が子どもを抱く自然な写真、黄色い相談導線を明快に。'],
    ['未来の健康を、今測る。', '生活習慣病リスク検査', '検査票、採血管、生活道具を透明なレイヤーで組む科学誌風の広告。'],
  ]),
  'it-saas': entries([
    ['請求書、もう迷わない。', '月末業務を80%短縮', '机上の請求書、実務画面、経理担当者の手元を青白の実用広告にする。'],
    ['採用管理を、ひとつに。', '候補者対応をチームで共有', '採用担当二人の会話、紙の付箋、スマホを大胆な切り抜きと作字で組む。'],
    ['顧客の声が、見えてくる。', 'アンケート分析を自動化', '録音波形、回答カード、担当者の横顔を赤白の編集グラフィックにする。'],
    ['勤怠集計、5分で完了。', 'クラウド勤怠の決定版', '暗い管制室ではなく夜の小規模オフィス、実務ダッシュボードと青い光。'],
    ['商談の次手が、わかる。', 'AI営業支援で受注を前へ', '営業担当の会話、矢印とメモ、橙色の手描き線を使う人間中心のSaaS広告。'],
    ['問い合わせを、資産に。', 'FAQを自動で育てる', '実在感あるサポート担当、紙の問い合わせカード、画面断片を白場に整理。'],
    ['経費精算、スマホで完結。', '申請から承認まで最短1分', 'スマホの接写、領収書の皺、承認印を青黄の斜め構図にする。'],
    ['数字で見る、チームの今。', '経営ダッシュボードを一画面に', '会議室の手描きグラフとモニター、社員二人を小さく置く。'],
    ['画像制作、もっと速く。', '広告クリエイティブを自動生成', '印刷物、撮影現場、画面を青い編集グリッドへ配置し、AIの球体表現を使わない。'],
    ['契約更新を、逃さない。', '顧客管理とアラートを自動化', '更新期限の紙札、花ではなく赤い糸とデスクの静物で期限を表現。'],
  ]),
  'it-technology': entries([
    ['開発速度を、次の次元へ。', 'AIコードレビューを自動化', '夜の開発現場、紙の設計図と実コード画面、緑の単色アクセント。'],
    ['映像を、もっと自由に。', '次世代カメラ開発キット', '基板、レンズ、撮影者を雑誌のように分割した製品開発ドキュメント。'],
    ['ひろく残そう、今日の空気。', 'ワイドインスタントカメラ', 'くすんだ青地、オリジナルカメラ、物理写真2枚、静かな商品エディトリアル。'],
    ['最適な一台が、見つかる。', '業務端末かんたん診断', '4種の端末と4人の働く姿を色面で区切る比較広告。'],
    ['深く、正確に、守る。', '次世代セキュリティ基盤', '黒い金属機器、冷たい横光、回路の実写接写で防御を表現。'],
    ['空間が、仕事場になる。', '没入型ワークデバイス', '赤い布張りの椅子とヘッドセット、人物は影だけにした造形的な商品広告。'],
    ['操作は、もっと直感的に。', '新型コントローラー登場', 'パステルの実機2台、樹脂の細かな傷、手の使用感を見せる。'],
    ['倉庫を、止めない。', '自律搬送ロボット導入支援', '実在する物流倉庫、現場作業者、黄色い安全線、機械の汚れを写す。'],
    ['通信費、まとめて軽く。', '法人回線を一括管理', '巨大な赤黒の作字と一人の担当者、数字を主役にした量販広告。'],
    ['その撮影、プロ仕様に。', '高性能スマートカメラ', '黒橙の小型カメラ、金属スタンド、光学試験表を硬質な静物で見せる。'],
  ]),
  'education-seminar': entries([
    ['なぜ、心は揺れるのか。', '感情を読み解く 心理学入門', '生成り紙、石膏像断片、朱赤図形、版ずれを使う文化講座の作字広告。'],
    ['企業価値を、言葉にする。', 'ブランド戦略 無料セミナー', '話者二人の硬いポートレート、橙と黒の斜め作字、紙の質感。'],
    ['正解のない時代を、学ぶ。', '対話で深める思考講座', '受講者二人の会話、余白の多い生成り紙、鉛筆の議論メモ。'],
    ['学びを、現場へ。', '実践型リーダー研修', '小さな会議室の実景、机上の資料、青白黄の明快な三角構成。'],
    ['自然から、教わろう。', '親子フィールドスクール', '山の現地学習、雨具の家族、植物標本を使う環境教育誌風。'],
    ['介護の仕事を、強くする。', '現場改善オンライン講座', '介護職の手元と記録ノート、黄色い帯、誠実な実務写真。'],
    ['物語のつくり方。', '脚本家による特別授業', '講師二人のモノクロポートレート、原稿用紙、太い明朝のタイトル。'],
    ['生成AIを、実務の力に。', 'マーケティング活用セミナー', 'デモ画面ではなく講師の議論、付箋、図解を青黄の紙面で編集。'],
    ['地域メディアを育てる。', '編集視点の実践ウェビナー', '地方紙、取材ノート、編集者の自然な作業姿を緑のコラージュにする。'],
    ['挑戦できる場を、つくる。', '経営者向け組織設計講座', '男女の経営者ポートレート、紫の引用符、大きな余白を使う。'],
  ]),
  'recruit-career': entries([
    ['その経験、次の舞台へ。', '即戦力メンバー募集中', '劇場裏のような暗い職場、社員数人の硬いポートレート、赤黒の求人広告。'],
    ['私たちと、未来をつくる。', '新卒エンジニア採用', '若手チームの自然な集合、ピンクの紙面、ジャンプではなく作業中の瞬間。'],
    ['友だちみたいなチーム。', 'カスタマーサクセス募集', '昼休みの会話と会社のマスコットではなく手作りの掲示物を使う。'],
    ['好きが、仕事になる。', 'コンテンツ企画職募集', '編集室の壁、映像モニター、相談中の三人を紫の光で捉える。'],
    ['自然と働く。', 'アウトドア事業スタッフ募集', '森の現場、濡れたジャケット、道具の傷、深緑の誠実な求人広告。'],
    ['介護の明日を、一緒に。', '未経験から始められます', '高齢者と職員の自然な会話、白青の余白、現場の温度を優先。'],
    ['強い女性が、活躍中。', '営業リーダー候補募集', '黒赤のスタジオポートレート、三人の異なる表情、強い明朝作字。'],
    ['地域を、もっと面白く。', 'まちづくりスタッフ募集', '商店街の夜、店主との打合せ、料理写真を編集グリッドにする。'],
    ['つくる人を、募集します。', 'プロダクトデザイナー採用', '模型、工具、会話中のデザイナー二人を生成りの誌面に配置。'],
    ['自分らしい服で働こう。', 'アパレル販売スタッフ募集', '店舗バックヤードの実景、異なる服装のスタッフ4人、青桃の作字。'],
  ]),
  'realestate-housing': entries([
    ['暮らしの展示会、開催。', '来場でギフトプレゼント', '実際のモデルハウスで図面を見る夫婦、黄色い余白と予約導線。'],
    ['海のそばで、働き暮らす。', '移住相談会 参加無料', '港町、仕事場、古い平屋を斜め写真グリッドで組む。'],
    ['家族時間が、増える家。', '新築一戸建て完成見学会', '朝の台所、子どもの宿題、黒白写真と黄色い小さな帯。'],
    ['平屋という、心地よさ。', '週末オープンハウス', '低い木造住宅と庭、曇天の落ち着いた建築写真、青い明朝。'],
    ['上質を、日常に。', '都市型モデルハウス公開', '実在感ある狭小住宅、コンクリートと木、夜の窓明かりを使う。'],
    ['長く住める家を、見よう。', 'ロングライフ住宅見学会', '世代の異なる家族と経年した木材、青白の実用的な構成。'],
    ['設計相談、ライブ配信。', '家づくりをもっと自由に', '建築家の机、図面、模型、夫婦の会話を緑の編集画面にする。'],
    ['住む人の、棚を見に行く。', '第12回　料理家の小さな台所', '生活取材写真6点、縦見出し、深緑の太枠、下部の誌面タイトル。'],
    ['旅するように、住む。', '家具つき賃貸キャンペーン', '大きな窓、旅鞄、生活途中の部屋、深緑と黄土の静かな広告。'],
    ['家賃補助、10万円。', '期間限定 入居サポート', '巨大な数字、実在感ある賃貸住宅、若い夫婦を青金の情報広告にする。'],
  ]),
  'finance-insurance': entries([
    ['家計を、ひとつに。', '無料の資産管理サービス', '紙の家計簿とスマホ、普通の食卓、青白の信頼感ある金融広告。'],
    ['夏の出費に、備える。', '目的別積立をかんたん設定', '祭りの領収書、貯金瓶、家族の後ろ姿を生成りと青で編集。'],
    ['お金と、ゆっくり向き合う。', '初心者向け資産形成ガイド', '夜の机、鉛筆の計算、人物の横顔を深い青の読み物広告にする。'],
    ['夜でも、すぐに相談。', 'オンライン保険相談 24時間', '自宅の暗い机と相談員、黄色い文字、実際の会話画面を小さく見せる。'],
    ['住宅ローン、比べて納得。', '金利プランを一括診断', '住宅模型、二人の相談、青橙のグラフを折込チラシの密度で組む。'],
    ['将来資金を、見える化。', '無料ライフプラン作成', '手描き年表、家族写真、数字のメモを白場の多い相談広告にする。'],
    ['22才からの資産形成。', '少額積立ではじめよう', '若い社会人の硬いポートレート、橙と紺の斜線、巨大な年齢数字。'],
    ['投資の基本、無料セミナー。', 'みんなの疑問に答えます', '新聞紙の質感、大きな黒黄作字、講師一人の自然な説明姿。'],
    ['保険選び、間違えない。', '10分でわかる保障診断', '医療・家族・老後の物理カードと一人の相談者を青白で明快に。'],
    ['老後資金の無料相談。', '遅くない、今が始めどき。', '高齢夫婦の実生活写真、金色の紙面、過度に幸福を演出しない。'],
  ]),
  'travel-tourism': entries([
    ['夜市へ、ふらり。', '2泊3日の台湾旅', '夜市の雑踏、料理の小写真、縦書き日程を旅雑誌の密度で組む。'],
    ['名古屋で、食べ歩こう。', 'ご当地グルメ満喫プラン', '味噌料理、喫茶店、城、旅人二人を黄色い斜めグリッドへ配置。'],
    ['旅先で、乾杯。', 'クラフトドリンク巡り', '土地ごとの瓶、地図、旅人の手元を桃色の手描きイラストと混ぜる。'],
    ['まだ知らない街へ。', '路地裏さんぽ特集', '手描き地図、古い商店、旅人の背中、橙と青の印刷物感。'],
    ['ずっと一緒の、夏旅。', '家族旅行 早割3,000円', '列車窓の家族、少し曇った海、空色の大きな作字。'],
    ['心ほどける、里山へ。', '温泉宿キャンペーン', '夕景の棚田、湯気、旅館の食事を和紙のコラージュにする。'],
    ['王子さまに、会いに行く。', '夢のテーマパークツアー', '架空の遊園地、友人三人、紙の王冠、桃と水色の賑やかな広告。'],
    ['美しすぎる終着駅。', 'ローカル線の旅10選', 'スマホのフレーム内に山間駅、外側に切符と時刻表を配置。'],
    ['あじさい色の、週末。', '名所をめぐる日帰り旅', '雨の寺、紫陽花、傘の二人を和菓子の包装紙のような構成にする。'],
    ['新幹線で、もっと近く。', '駅から始まる小さな旅', '車窓、旅先の小写真、青い速度線、黄色い予約導線を機能的に。'],
  ]),
  'event-media': entries([
    ['音が、物語になる。', '新人アーティストライブ', '舞台袖の歌手、破れた青紙、金の明朝、ライブ写真の粒子。'],
    ['食卓から、未来を話そう。', '食と暮らしのフェス', '登壇者の小窓、料理、会話を青い波模様のコミュニティ紙面にする。'],
    ['好きが集まる、文化祭。', 'クリエイター合同イベント', '制作中の人々を緑の写真グリッドにし、手描きタイトルを大きく置く。'],
    ['夜空に浮かぶ、味わい。', '期間限定ナイトバー', '透明な抽象物、カクテル、青桃の照明を展覧会ポスターのように組む。'],
    ['お金の不安を、ほどく。', '朝10分の経済メディア', '朝の窓辺、スマホ、手描きグラフ、黄黒の読み物広告。'],
    ['みんなの写真で、乾杯。', '創業150周年フォト企画', '投稿写真の紙焼き、食卓、黄色い応募帯をアナログコラージュにする。'],
    ['光の中へ、迷い込む。', '没入型アート展', '暗い展示室、来場者の影、紫の光粒、細い明朝の展覧会広告。'],
    ['朝の10分で、賢くなる。', 'ビジネスニュース配信', '紙面の稲妻作字、スマホを見る会社員、青黄のスポーツ紙的な勢い。'],
    ['街を味わう、音楽祭。', 'グルメとライブを満喫', '都市の屋台、演奏者、来場者を橙青のイラストと写真で混ぜる。'],
    ['AI時代の、つくり方。', 'プロダクトカンファレンス', '二人の登壇者、マゼンタと青の斜面、実際のステージ写真を使う。'],
  ]),
  'lifestyle-pet': entries([
    ['夏の暮らしを、涼しく。', 'ひんやり雑貨フェア', '扇風機、冷感布、籠、昼寝する猫を涼しい棚の写真で見せる。'],
    ['毎日を、少し便利に。', '新生活グッズ特集', '卓上扇風機、水筒、傘を青い台座へ静物撮影する。'],
    ['書く時間を、贈ろう。', '文具ギフトガイド', '万年筆3本、封筒、インク染みを茶色い机の横光で撮る。'],
    ['ありがとうを、かたちに。', '父の日ギフト特集', 'シャツ、スリッパ、マグを生活の棚に置き、青白の機能的な広告に。'],
    ['休日を、もっと好きに。', '暮らしの道具セレクション', '男女と犬の手描き線画、眼鏡、コーヒー、包装紙を静かに配置。'],
    ['香る、台所。', 'スパイスと保存食のセット', '木匙、瓶詰め、乾燥ハーブ、古い台所の俯瞰写真を植物図鑑風に。'],
    ['お父さんに、黄色い花を。', '感謝を伝える贈りもの', '黄色い花束、父娘の自然な会話、刺繍枠風の紙面を作る。'],
    ['お母さんと、乾杯。', '母の日テーブルギフト', '赤ワイン、皿、カーネーション、夕方の食卓を赤生成りでまとめる。'],
    ['一輪で、部屋が変わる。', '季節の花 定期便', '白い花瓶と一輪の花、長い影、赤い明朝だけの極小広告。'],
    ['好きって、あなた色。', 'ペット用品 新作コレクション', '普通の飼い主と犬猫、使用途中の器と玩具、青い切り抜きコラージュ。'],
  ]),
};

const artDirections = [
  'independent Japanese magazine editorial; tactile paper, real print grain, asymmetrical hierarchy',
  'documentary commercial photography; available light, believable skin and material imperfections',
  'premium product still life; real contact shadows, fingerprints, seams, restrained typography',
  'bold custom Japanese typography; physical screen-print variation and deliberate optical spacing',
  'cut-paper photo collage; visible paper edges, halftone, imperfect registration, no digital gloss',
  'dense Japanese campaign design; disciplined information hierarchy, real photographic sizzle',
  'quiet cultural-institution poster; Mincho/Gothic contrast, generous negative space, one accent',
  'vernacular retail graphic design refined by an experienced art director; energetic but not generic',
  'photojournalistic feature layout; multiple unequal frames, coherent subject continuity, honest texture',
  'experimental fashion/editorial art direction; unusual crop, strict palette, typography as image',
];

const completedPrototypeMap = {
  'education-seminar-01': '01-education-editorial.webp',
  'it-technology-03': '02-product-camera.webp',
  'realestate-housing-08': '03-housing-editorial.webp',
  'ec-sale-07': '04-typography-sale.webp',
  'food-beverage-02': '05-food-campaign.webp',
};

await fs.promises.mkdir(path.join(targetRoot, 'references'), { recursive: true });
await fs.promises.mkdir(path.join(targetRoot, 'images'), { recursive: true });
await fs.promises.mkdir(path.join(targetRoot, 'raw'), { recursive: true });

const inventory = JSON.parse(await fs.promises.readFile(path.join(sourceRoot, 'reference-inventory.json'), 'utf8'));
const genreOrder = [...new Set(inventory.map((item) => item.genreSlug))];
const requests = [];

for (const item of inventory) {
  const slot = Number(item.templateId.match(/-(\d{2})$/)?.[1] ?? 0) - 1;
  const genreIndex = genreOrder.indexOf(item.genreSlug);
  const brief = copySets[item.genreSlug]?.[slot];
  if (!brief) throw new Error(`Missing creative brief for ${item.templateId}`);

  const downloaded = path.join(downloadedReferenceRoot, `${item.templateId}.img`);
  const referenceRel = `references/${item.templateId}.jpg`;
  const referenceAbs = path.join(targetRoot, referenceRel);
  await sharp(downloaded).jpeg({ quality: 95 }).toFile(referenceAbs);

  const prototypeFile = completedPrototypeMap[item.templateId];
  const outputRel = `images/${item.templateId}.webp`;
  if (prototypeFile) {
    await fs.promises.copyFile(path.join(prototypeRoot, 'images', prototypeFile), path.join(targetRoot, outputRel));
  }

  const text = [brief.headline, brief.subcopy].filter(Boolean);
  const prompt = {
    use_case: 'ads-marketing',
    asset_type: 'Japanese web display banner, landscape 1.91:1',
    primary_request: `Create a completely original ${item.genre} campaign banner. Use Image 1 only as a visual reference for its composition logic, typography hierarchy, spacing, image density, crop, and print sensibility. Do not copy its brand, logo, people, products, wording, illustrations, or exact arrangement.`,
    input_images: [{ image: 'Image 1', role: 'style and composition reference only', path: referenceRel, source_url: item.url }],
    original_concept: brief.concept,
    style_medium: artDirections[(genreIndex * 3 + slot) % artDirections.length],
    composition_framing: 'Wide 1.91:1 banner. Reinterpret the reference structure with different subjects and a distinct layout signature. Preserve deliberate editorial tension; do not default to a left-copy/right-stock-person template.',
    text_verbatim: text,
    typography: 'Render every quoted Japanese phrase exactly once, fully legibly, with real optical spacing and strong size contrast. The copy is part of the generated artwork.',
    constraints: [
      'all text must be baked into the generated image; no later text overlay',
      'use only the strings in text_verbatim and no extra words',
      'original unbranded concept with no trademarks or recognizable public figures',
      'believable materials, anatomy, lighting, print texture, and human art direction',
      'produce the whole final banner as one image',
    ],
    avoid: [
      'generic AI advertising look', 'porcelain stock-model face', 'rounded CTA pill', 'floating UI cards',
      'neon gradient blob', 'glossy 3D icon', 'fake logo', 'gibberish', 'extra text',
      'overly centered symmetry', 'copying the reference literally',
    ],
  };

  requests.push({
    templateId: item.templateId,
    genre: item.genre,
    genreSlug: item.genreSlug,
    reference: { id: item.id, title: item.title, url: item.url, tags: item.tags, imagePath: referenceRel },
    output: { imagePath: outputRel, rawPath: `raw/${item.templateId}.png`, width: 1200, height: 628, format: 'webp' },
    status: prototypeFile ? 'completed_prototype' : 'pending',
    attempts: prototypeFile ? 1 : 0,
    prompt,
  });
}

const payload = {
  version: 2,
  createdAt: new Date().toISOString(),
  generationMode: 'Codex built-in image generation; one call per image; no external image-generation API',
  total: requests.length,
  completed: requests.filter((request) => request.status.startsWith('completed')).length,
  pending: requests.filter((request) => request.status === 'pending').length,
  requests,
};

await fs.promises.writeFile(path.join(targetRoot, 'generation-requests.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ targetRoot, total: payload.total, completed: payload.completed, pending: payload.pending }, null, 2));
