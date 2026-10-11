<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Violation extends Model
{
    // type => severity
    public const TYPES = [
        'tab_switch' => 'medium',
        'window_blur' => 'medium',
        'fullscreen_exit' => 'medium',
        'paste_attempt' => 'medium',
        'copy_attempt' => 'low',
        'mouse_left' => 'low',
        'app_detected' => 'high',
        'other' => 'low',
    ];

    protected $fillable = ['exam_session_id', 'type', 'severity', 'details'];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ExamSession::class, 'exam_session_id');
    }
}