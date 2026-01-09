/**
 * Google Cloud Storageアップロードのテストスクリプト
 * 
 * 使用方法:
 * 1. 環境変数を設定:
 *    export GOOGLE_CLOUD_PROJECT_ID="gen-lang-client-0767544294"
 *    export GCS_BUCKET_NAME="doya-interview-storage"
 *    export GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'
 * 
 * 2. テストファイルを作成:
 *    echo "test content" > test-file.txt
 * 
 * 3. スクリプトを実行:
 *    node test-gcs-upload.js
 */

const { Storage } = require('@google-cloud/storage');

async function testGCSUpload() {
  try {
    // 環境変数の確認
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const bucketName = process.env.GCS_BUCKET_NAME;
    const credentialsStr = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    console.log('=== 環境変数の確認 ===');
    console.log('GOOGLE_CLOUD_PROJECT_ID:', projectId ? '✓' : '✗');
    console.log('GCS_BUCKET_NAME:', bucketName ? '✓' : '✗');
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', credentialsStr ? '✓' : '✗');

    if (!projectId || !bucketName || !credentialsStr) {
      throw new Error('必要な環境変数が設定されていません');
    }

    // 認証情報のパース
    let credentials;
    try {
      credentials = JSON.parse(credentialsStr);
    } catch (error) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALSが有効なJSON形式ではありません');
    }

    // Storageクライアントの初期化
    const storage = new Storage({
      projectId,
      credentials,
    });

    const bucket = storage.bucket(bucketName);

    // バケットの存在確認
    console.log('\n=== バケットの確認 ===');
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error(`バケット "${bucketName}" が存在しません`);
    }
    console.log(`バケット "${bucketName}" が存在します ✓`);

    // テストファイルのアップロード
    console.log('\n=== テストファイルのアップロード ===');
    const testFilePath = `interview/test/${Date.now()}-test-file.txt`;
    const testContent = Buffer.from('This is a test file for GCS upload verification');
    
    const file = bucket.file(testFilePath);
    await file.save(testContent, {
      metadata: {
        contentType: 'text/plain',
      },
      public: true,
    });

    console.log(`ファイルをアップロードしました: ${testFilePath}`);

    // ファイルの確認
    const [metadata] = await file.getMetadata();
    const url = `https://storage.googleapis.com/${bucketName}/${testFilePath}`;
    console.log(`ファイルURL: ${url}`);
    console.log(`ファイルサイズ: ${metadata.size} bytes`);

    // ファイルの削除（クリーンアップ）
    console.log('\n=== テストファイルの削除 ===');
    await file.delete();
    console.log('テストファイルを削除しました ✓');

    console.log('\n=== テスト完了 ===');
    console.log('✓ Google Cloud Storageへのアップロードが正常に動作しています');

  } catch (error) {
    console.error('\n=== エラー ===');
    console.error('エラーメッセージ:', error.message);
    console.error('エラーコード:', error.code);
    console.error('エラー詳細:', error);
    
    if (error.code === 401 || error.message?.includes('Unauthorized')) {
      console.error('\n認証エラーが発生しました。');
      console.error('確認事項:');
      console.error('1. GOOGLE_APPLICATION_CREDENTIALSが正しく設定されているか');
      console.error('2. サービスアカウントキーが有効か');
      console.error('3. サービスアカウントに適切な権限があるか');
    } else if (error.code === 403 || error.message?.includes('Forbidden')) {
      console.error('\n権限エラーが発生しました。');
      console.error('確認事項:');
      console.error('1. サービスアカウントに「Storage Object Admin」ロールが付与されているか');
      console.error('2. バケットへのアクセス権限があるか');
    } else if (error.code === 404 || error.message?.includes('Not found')) {
      console.error('\nバケットが見つかりません。');
      console.error('確認事項:');
      console.error('1. GCS_BUCKET_NAMEが正しいか');
      console.error('2. バケットが存在するか');
    }
    
    process.exit(1);
  }
}

testGCSUpload();

