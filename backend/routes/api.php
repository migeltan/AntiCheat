<?php

use Illuminate\Support\Facades\Route;

// All routes here are automatically prefixed with /api

// Health check - the React home page calls this to show "Backend online"
Route::get('/ping', fn () => response()->json([
    'app' => 'AntiCheat API',
    'status' => 'ok',
    'time' => now()->toIso8601String(),
]));
