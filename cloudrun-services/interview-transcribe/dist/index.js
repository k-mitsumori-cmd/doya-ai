"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const transcribe_1 = require("./transcribe");
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
// CORS設定
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'interview-transcribe' });
});
// 音声変換エンドポイント
app.post('/transcribe', async (req, res) => {
    try {
        const { gcsUri, mimeType, fileName, isVideoFile, fileSize } = req.body;
        // バリデーション
        if (!gcsUri) {
            return res.status(400).json({
                error: 'gcsUri is required',
                details: 'GCS URI must be provided',
            });
        }
        console.log('[CLOUDRUN] Transcribe request received');
        console.log('[CLOUDRUN] GCS URI:', gcsUri);
        console.log('[CLOUDRUN] MIME Type:', mimeType || 'N/A');
        console.log('[CLOUDRUN] File Name:', fileName || 'N/A');
        console.log('[CLOUDRUN] Is Video:', isVideoFile || false);
        console.log('[CLOUDRUN] File Size:', fileSize ? `${(fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A');
        // 音声変換を実行
        const transcriptionText = await (0, transcribe_1.transcribeAudio)({
            gcsUri,
            mimeType,
            fileName,
            isVideoFile: isVideoFile || false,
            fileSize: fileSize || 0,
        });
        console.log('[CLOUDRUN] Transcription completed');
        console.log('[CLOUDRUN] Text Length:', transcriptionText.length);
        console.log('[CLOUDRUN] Preview:', transcriptionText.substring(0, 100) + (transcriptionText.length > 100 ? '...' : ''));
        res.json({
            success: true,
            transcription: transcriptionText,
        });
    }
    catch (error) {
        console.error('[CLOUDRUN] Transcription error:', error);
        console.error('[CLOUDRUN] Error Code:', error?.code || 'N/A');
        console.error('[CLOUDRUN] Error Message:', error?.message || 'N/A');
        console.error('[CLOUDRUN] Error Details:', error?.details || 'N/A');
        let statusCode = 500;
        let errorMessage = 'Transcription failed';
        let errorDetails = error?.message || 'Unknown error';
        // エラーコード別の処理
        if (error?.code === 3) {
            statusCode = 400;
            errorMessage = 'Invalid request';
            if (error?.details?.includes('bad encoding')) {
                errorDetails = 'Encoding error occurred. Please check the file format.';
            }
        }
        else if (error?.code === 7) {
            statusCode = 500;
            errorMessage = 'Authentication error';
            if (error?.reason === 'SERVICE_DISABLED') {
                errorMessage = 'Google Cloud Speech-to-Text API is not enabled';
                errorDetails = 'Please enable the API in Google Cloud Console.';
            }
            else {
                errorDetails = 'Access permission to Google Cloud Speech-to-Text API is denied.';
            }
        }
        else if (error?.code === 8) {
            statusCode = 503;
            errorMessage = 'Resource exhausted';
            errorDetails = 'Please try again later.';
        }
        else if (error?.code === 13) {
            statusCode = 500;
            errorMessage = 'Internal error';
            errorDetails = 'An error occurred in the Google Cloud Speech-to-Text service.';
        }
        res.status(statusCode).json({
            error: errorMessage,
            details: errorDetails,
            code: error?.code,
        });
    }
});
app.listen(port, () => {
    console.log(`[CLOUDRUN] Interview transcribe service listening on port ${port}`);
    console.log(`[CLOUDRUN] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[CLOUDRUN] Project ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID || 'N/A'}`);
});
