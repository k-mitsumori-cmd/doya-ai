"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAudioFromMP4 = extractAudioFromMP4;
const storage_1 = require("@google-cloud/storage");
const child_process_1 = require("child_process");
const util_1 = require("util");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const os_1 = require("os");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Storageクライアントの初期化
let storage = null;
function getStorage() {
    if (!storage) {
<<<<<<< HEAD
        // 認証情報の取得（Base64エンコードされたJSON文字列もサポート）
        let credsEnvVar = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (!credsEnvVar && process.env.GOOGLE_APPLICATION_CREDENTIALS_B64) {
            // Base64エンコードされたJSON文字列をデコード
            try {
                credsEnvVar = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_B64, 'base64').toString('utf-8');
                console.log('[AUDIO-EXTRACTOR] Decoded credentials from Base64');
            }
            catch (decodeError) {
                throw new Error(`Failed to decode Base64 credentials: ${decodeError.message}`);
            }
        }
        if (!credsEnvVar) {
            throw new Error('GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_B64 environment variable is not set');
=======
        const credsEnvVar = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (!credsEnvVar) {
            throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
>>>>>>> d95c3593108505b4f8da75e5f5c92339c7648b3f
        }
        let credentials;
        try {
            const credsStr = credsEnvVar.trim();
            if (credsStr.startsWith('{')) {
                credentials = JSON.parse(credsStr);
            }
            else {
                throw new Error('GOOGLE_APPLICATION_CREDENTIALS must be a JSON string');
            }
        }
        catch (parseError) {
            throw new Error(`Failed to parse credentials: ${parseError.message}`);
        }
        storage = new storage_1.Storage({
            projectId: credentials.project_id || process.env.GOOGLE_CLOUD_PROJECT_ID,
            credentials,
        });
        console.log('[AUDIO-EXTRACTOR] Storage client initialized');
    }
    return storage;
}
/**
 * GCS URIからバケット名とファイルパスを抽出
 */
function parseGcsUri(gcsUri) {
    const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match || !match[1] || !match[2]) {
        throw new Error(`Invalid GCS URI: ${gcsUri}`);
    }
    return {
        bucketName: match[1],
        filePath: match[2],
    };
}
/**
 * MP4ファイルから音声を抽出してFLAC形式に変換
 * @param gcsUri MP4ファイルのGCS URI
 * @returns 変換されたFLACファイルのGCS URI
 */
async function extractAudioFromMP4(gcsUri) {
    console.log('[AUDIO-EXTRACTOR] Starting audio extraction from MP4');
    console.log('[AUDIO-EXTRACTOR] Source GCS URI:', gcsUri);
    const storage = getStorage();
    const { bucketName, filePath } = parseGcsUri(gcsUri);
    // 一時ファイルのパス
    const tempDir = (0, os_1.tmpdir)();
    const timestamp = Date.now();
    const inputFilePath = (0, path_1.join)(tempDir, `input-${timestamp}.mp4`);
    const outputFilePath = (0, path_1.join)(tempDir, `output-${timestamp}.flac`);
    try {
        // 1. GCSからMP4ファイルをダウンロード
        console.log('[AUDIO-EXTRACTOR] Downloading MP4 file from GCS...');
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filePath);
        const [buffer] = await file.download();
        await (0, promises_1.writeFile)(inputFilePath, buffer);
        console.log('[AUDIO-EXTRACTOR] ✓ MP4 file downloaded');
        console.log('[AUDIO-EXTRACTOR] File size:', `${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        // 2. FFmpegを使って音声を抽出してFLACに変換
        console.log('[AUDIO-EXTRACTOR] Extracting audio and converting to FLAC...');
        // -i: 入力ファイル
        // -vn: ビデオストリームを無視
        // -acodec flac: FLACコーデックを使用
        // -ac 1: モノラルに変換（Speech-to-Text APIの推奨）
        // -ar 16000: サンプリングレートを16kHzに変換（Speech-to-Text APIの推奨）
        // -y: 出力ファイルが存在する場合に上書き
        const ffmpegCommand = `ffmpeg -i "${inputFilePath}" -vn -acodec flac -ac 1 -ar 16000 -y "${outputFilePath}"`;
        const startTime = Date.now();
        const { stdout, stderr } = await execAsync(ffmpegCommand);
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        if (stderr) {
            console.log('[AUDIO-EXTRACTOR] FFmpeg stderr:', stderr);
        }
        console.log('[AUDIO-EXTRACTOR] ✓ Audio extracted and converted to FLAC');
        console.log('[AUDIO-EXTRACTOR] Elapsed time:', `${elapsedTime} seconds`);
        // 3. 変換されたFLACファイルを読み込む
        const flacBuffer = await (0, promises_1.readFile)(outputFilePath);
        console.log('[AUDIO-EXTRACTOR] FLAC file size:', `${(flacBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        // 4. FLACファイルをGCSにアップロード
        console.log('[AUDIO-EXTRACTOR] Uploading FLAC file to GCS...');
        const flacFileName = filePath.replace(/\.mp4$/i, '.flac').replace(/\.MP4$/i, '.flac');
        const flacFile = bucket.file(flacFileName);
        await flacFile.save(flacBuffer, {
            metadata: {
                contentType: 'audio/flac',
            },
        });
        const flacGcsUri = `gs://${bucketName}/${flacFileName}`;
        console.log('[AUDIO-EXTRACTOR] ✓ FLAC file uploaded to GCS');
        console.log('[AUDIO-EXTRACTOR] FLAC GCS URI:', flacGcsUri);
        return flacGcsUri;
    }
    catch (error) {
        console.error('[AUDIO-EXTRACTOR] Error during audio extraction:', error);
        // FFmpegエラーの詳細を確認
        if (error.stderr) {
            console.error('[AUDIO-EXTRACTOR] FFmpeg stderr:', error.stderr);
        }
        throw new Error(`Failed to extract audio from MP4: ${error.message}`);
    }
    finally {
        // 5. 一時ファイルを削除
        try {
            await Promise.all([
                (0, promises_1.unlink)(inputFilePath).catch(() => { }),
                (0, promises_1.unlink)(outputFilePath).catch(() => { }),
            ]);
            console.log('[AUDIO-EXTRACTOR] Temporary files cleaned up');
        }
        catch (cleanupError) {
            console.warn('[AUDIO-EXTRACTOR] Failed to cleanup temporary files:', cleanupError);
        }
    }
}
