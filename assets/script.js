// グローバル変数
let currentTranscript = '';
let currentArticle = '';

// DOM要素の取得
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultSection = document.getElementById('resultSection');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const errorMessage = document.getElementById('errorMessage');

// ファイルアップロード処理
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    // ファイル形式チェック
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
    const validExtensions = ['.mp3', '.wav'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        showError('対応していないファイル形式です。MP3またはWAV形式のファイルを選択してください。');
        return;
    }

    // エラーメッセージを非表示
    hideError();

    // アップロード画面を非表示、処理中画面を表示
    uploadSection.style.display = 'none';
    processingSection.classList.add('active');

    // 処理を開始
    startProcessing(file);
}

async function startProcessing(file) {
    // ステップ1: アップロード完了
    updateStep('stepUpload', 'completed', '✓', 'ファイルアップロード完了');
    updateProgress(33);

    // 少し待機（実際のアップロード処理をシミュレート）
    await sleep(1000);

    // ステップ2: 文字起こし処理
    updateStep('stepTranscribe', 'processing', '🔄', '文字起こし処理中...');
    updateProgress(50);

    // 疑似文字起こし処理
    const transcript = await mockTranscribe(file);
    currentTranscript = transcript;
    updateStep('stepTranscribe', 'completed', '✓', '文字起こし完了');
    updateProgress(66);

    // ステップ3: 記事生成処理
    updateStep('stepGenerate', 'processing', '🔄', '記事生成中...');
    updateProgress(80);

    // 疑似記事生成処理
    const article = await mockGenerateArticle(transcript);
    currentArticle = article;
    updateStep('stepGenerate', 'completed', '✓', '記事生成完了');
    updateProgress(100);

    // 少し待機してから結果画面を表示
    await sleep(500);
    showResults();
}

function updateStep(stepId, status, icon, text) {
    const step = document.getElementById(stepId);
    step.className = `step-item ${status}`;
    step.querySelector('.step-icon').textContent = icon;
    step.querySelector('.step-text').textContent = text;
}

function updateProgress(percentage) {
    document.getElementById('progressFill').style.width = percentage + '%';
}

function showResults() {
    processingSection.classList.remove('active');
    resultSection.classList.add('active');
    
    // 文字起こし結果を表示
    document.getElementById('transcriptContent').textContent = currentTranscript;
    
    // 記事を表示
    document.getElementById('articleContent').innerHTML = formatArticle(currentArticle);
}

// ============================================
// API連携用の関数（後で実装）
// ============================================

/**
 * 文字起こし処理（疑似処理）
 * 実際の実装では、ここでWhisper APIなどを呼び出す
 * 
 * @param {File} file - 音声ファイル
 * @returns {Promise<string>} 文字起こし結果
 */
async function mockTranscribe(file) {
    // 実際の実装例:
    // const formData = new FormData();
    // formData.append('file', file);
    // const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    //     method: 'POST',
    //     headers: {
    //         'Authorization': `Bearer ${API_KEY}`
    //     },
    //     body: formData
    // });
    // const data = await response.json();
    // return data.text;
    
    // 現在はダミーデータを返す
    await sleep(2000); // 処理時間をシミュレート
    
    // ダミーの文字起こし結果
    return `【インタビュー文字起こし結果】

インタビュアー: 本日はお忙しい中、お時間をいただきありがとうございます。まず、御社の現状について教えていただけますか？

回答者: はい、ありがとうございます。当社は製造業を営んでおり、従来は紙ベースの業務プロセスが中心でした。しかし、業務効率の低下や人的ミスの増加が課題となっていました。

インタビュアー: 具体的にはどのような課題があったのでしょうか？

回答者: 主な課題は3つあります。1つ目は、紙の管理に時間がかかりすぎることです。2つ目は、情報共有が遅れること。3つ目は、データの検索性が低いことです。これらの課題により、業務時間が30%も増加していました。

インタビュアー: その課題を解決するために、どのようなソリューションを導入されたのでしょうか？

回答者: デジタル化ソリューションを導入しました。具体的には、クラウドベースの業務管理システムを導入し、すべてのプロセスをデジタル化しました。これにより、リアルタイムでの情報共有が可能になり、検索性も大幅に向上しました。

インタビュアー: 導入後の効果はいかがでしたか？

回答者: 導入後、業務時間が50%削減され、人的ミスも80%減少しました。また、情報共有のスピードが向上し、意思決定が迅速になりました。コスト面でも、年間で約30%の削減を実現できました。

インタビュアー: 今後はどのような展開を予定されていますか？

回答者: 今後は、AIを活用したさらなる業務効率化を検討しています。また、他部署への展開も計画しており、全社的なデジタル化を推進していきます。`;
}

/**
 * 記事生成処理（疑似処理）
 * 実際の実装では、ここでClaude APIやGPT APIを呼び出す
 * 
 * @param {string} transcript - 文字起こし結果
 * @returns {Promise<Object>} 生成された記事オブジェクト
 */
async function mockGenerateArticle(transcript) {
    // 実際の実装例:
    // const response = await fetch('https://api.anthropic.com/v1/messages', {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'x-api-key': API_KEY,
    //         'anthropic-version': '2023-06-01'
    //     },
    //     body: JSON.stringify({
    //         model: 'claude-3-opus-20240229',
    //         max_tokens: 4000,
    //         messages: [{
    //             role: 'user',
    //             content: `以下のインタビュー文字起こしを元に、事例記事を生成してください。\n\n${transcript}`
    //         }]
    //     })
    // });
    // const data = await response.json();
    // return parseArticleResponse(data.content[0].text);
    
    // 現在はテンプレートベースのダミーデータを返す
    await sleep(2000); // 処理時間をシミュレート
    
    // テンプレートベースの記事生成（実際はAIで生成）
    return {
        lead: '製造業を営む企業様が、デジタル化ソリューションを導入し、業務効率を大幅に改善した事例をご紹介します。紙ベースの業務プロセスから脱却し、クラウドベースの業務管理システムを導入することで、業務時間の削減とコスト削減を実現しました。',
        challenge: {
            title: '課題',
            content: '従来の紙ベースの業務プロセスでは、以下の3つの課題がありました。',
            items: [
                {
                    title: '課題1: 紙の管理に時間がかかりすぎる',
                    content: '紙の管理に多くの時間を費やしており、本来の業務に集中できない状況でした。'
                },
                {
                    title: '課題2: 情報共有が遅れる',
                    content: '情報共有に時間がかかり、意思決定が遅れることが多々ありました。'
                },
                {
                    title: '課題3: データの検索性が低い',
                    content: '必要な情報を見つけるのに時間がかかり、業務効率が低下していました。'
                }
            ],
            impact: 'これらの課題により、業務時間が30%も増加していました。'
        },
        solution: {
            title: '解決策',
            content: 'この課題を解決するため、クラウドベースの業務管理システムを導入しました。',
            features: [
                'すべてのプロセスをデジタル化',
                'リアルタイムでの情報共有が可能',
                '検索性の大幅な向上'
            ]
        },
        effect: {
            title: '効果・成果',
            content: '導入後、以下のような効果が得られました。',
            quantitative: [
                '業務時間: 50%削減',
                '人的ミス: 80%減少',
                'コスト: 年間30%削減'
            ],
            qualitative: [
                '情報共有のスピードが向上',
                '意思決定が迅速に',
                '業務効率が大幅に改善'
            ]
        },
        summary: {
            title: 'まとめ',
            content: 'デジタル化ソリューションの導入により、業務効率とコスト削減を実現しました。今後は、AIを活用したさらなる業務効率化を検討しており、全社的なデジタル化を推進していく予定です。'
        }
    };
}

// ============================================
// ユーティリティ関数
// ============================================

function formatArticle(article) {
    let html = '';
    
    // リード文
    html += `<p style="font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #667eea;">${article.lead}</p>`;
    
    // 課題
    html += `<h2>${article.challenge.title}</h2>`;
    html += `<p>${article.challenge.content}</p>`;
    article.challenge.items.forEach(item => {
        html += `<h3>${item.title}</h3>`;
        html += `<p>${item.content}</p>`;
    });
    html += `<p><strong>${article.challenge.impact}</strong></p>`;
    
    // 解決策
    html += `<h2>${article.solution.title}</h2>`;
    html += `<p>${article.solution.content}</p>`;
    html += `<h3>導入した機能</h3>`;
    html += `<ul>`;
    article.solution.features.forEach(feature => {
        html += `<li>${feature}</li>`;
    });
    html += `</ul>`;
    
    // 効果・成果
    html += `<h2>${article.effect.title}</h2>`;
    html += `<p>${article.effect.content}</p>`;
    html += `<h3>定量的な成果</h3>`;
    html += `<ul>`;
    article.effect.quantitative.forEach(item => {
        html += `<li>${item}</li>`;
    });
    html += `</ul>`;
    html += `<h3>定性的な成果</h3>`;
    html += `<ul>`;
    article.effect.qualitative.forEach(item => {
        html += `<li>${item}</li>`;
    });
    html += `</ul>`;
    
    // まとめ
    html += `<h2>${article.summary.title}</h2>`;
    html += `<p>${article.summary.content}</p>`;
    
    return html;
}

function switchTab(tabName) {
    // タブの切り替え
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (tabName === 'transcript') {
        document.querySelector('.tab').classList.add('active');
        document.getElementById('transcriptTab').classList.add('active');
    } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('articleTab').classList.add('active');
    }
}

function copyToClipboard() {
    const activeTab = document.querySelector('.tab-content.active');
    const text = activeTab.id === 'transcriptTab' 
        ? currentTranscript 
        : activeTab.innerText;
    
    navigator.clipboard.writeText(text).then(() => {
        alert('クリップボードにコピーしました！');
    }).catch(err => {
        console.error('コピーに失敗しました:', err);
        alert('コピーに失敗しました。');
    });
}

function downloadArticle() {
    const content = currentArticle ? formatArticle(currentArticle) : currentTranscript;
    const text = document.createElement('div');
    text.innerHTML = content;
    const plainText = text.innerText || text.textContent;
    
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '事例記事_' + new Date().toISOString().slice(0, 10) + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function resetApp() {
    uploadSection.style.display = 'block';
    processingSection.classList.remove('active');
    resultSection.classList.remove('active');
    fileInput.value = '';
    currentTranscript = '';
    currentArticle = '';
    hideError();
    
    // ステップをリセット
    updateStep('stepUpload', '', '📤', 'ファイルアップロード');
    updateStep('stepTranscribe', '', '🔄', '文字起こし処理中...');
    updateStep('stepGenerate', '', '⏳', '記事生成待機中...');
    updateProgress(0);
}

function showError(message) {
    errorMessage.textContent = '⚠️ ' + message;
    errorMessage.classList.add('active');
}

function hideError() {
    errorMessage.classList.remove('active');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

