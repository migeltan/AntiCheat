<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ExamController;
use App\Http\Controllers\ExamSessionController;
use App\Http\Controllers\ViolationController;
use App\Http\Controllers\AnswerController;
use App\Http\Controllers\QuestionController;
use App\Http\Controllers\ExamSummaryController;
use App\Http\Controllers\GoogleFormController;
use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\SessionReviewController;
use App\Http\Controllers\SessionResultController;

// All routes here are automatically prefixed with /api

// Health check - the React home page calls this to show "Backend online"
Route::get('/ping', fn () => response()->json([
    'app' => 'AntiCheat API',
    'status' => 'ok',
    'time' => now()->toIso8601String(),
]));

// ---------- Student routes (no admin key) ----------
Route::get('/exams/code/{code}', [ExamController::class, 'showByCode']);
Route::post('/exams/code/{code}/sessions', [ExamSessionController::class, 'start']);
Route::get('/sessions/{examSession}', [ExamSessionController::class, 'show']);
Route::get('/sessions/{examSession}/questions', [QuestionController::class, 'forSession']);
Route::get('/sessions/{examSession}/answers', [AnswerController::class, 'index']);
Route::get('/sessions/{examSession}/result', SessionResultController::class);
Route::put('/sessions/{examSession}/answers', [AnswerController::class, 'save']);
Route::post('/sessions/{examSession}/violations', [ViolationController::class, 'store']);
Route::post('/sessions/{examSession}/submit', [ExamSessionController::class, 'submit']);

// ---------- Admin sign-in (teacher ID + password) ----------
Route::post('/admin/login', [AdminAuthController::class, 'login'])->middleware('throttle:10,1');

// ---------- Admin routes (require a signed-in teacher) ----------
Route::middleware('admin.auth')->group(function () {
    Route::get('/admin/me', [AdminAuthController::class, 'me']);
    Route::post('/admin/logout', [AdminAuthController::class, 'logout']);
    Route::get('/exams', [ExamController::class, 'index']);
    Route::post('/exams', [ExamController::class, 'store']);
    Route::patch('/exams/{exam}/publish', [ExamController::class, 'publish']);
    Route::patch('/exams/{exam}/close', [ExamController::class, 'close']);
    Route::patch('/exams/{exam}/score-visibility', [ExamController::class, 'setScoreVisibility']);

    Route::get('/exams/{exam}/sessions', [ExamSessionController::class, 'index']);
    Route::get('/exams/{exam}/violations', [ViolationController::class, 'forExam']);
    Route::get('/exams/{exam}/summary', ExamSummaryController::class);
    Route::get('/exams/{exam}/questions', [QuestionController::class, 'index']);
    Route::post('/exams/{exam}/questions', [QuestionController::class, 'import']);
    Route::put('/exams/{exam}/answer-key', [QuestionController::class, 'saveKey']);

    Route::get('/sessions/{examSession}/violations', [ViolationController::class, 'index']);
    Route::get('/admin/sessions/{examSession}', [SessionReviewController::class, 'show']);
    Route::patch('/admin/sessions/{examSession}/review', [SessionReviewController::class, 'update']);

    Route::post('/forms/fetch', [GoogleFormController::class, 'fetch'])->middleware('throttle:10,1');
});