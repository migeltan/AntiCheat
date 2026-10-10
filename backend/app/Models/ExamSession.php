<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamSession extends Model
{
    protected $fillable = [
        'exam_id', 'student_name', 'student_number',
        'status', 'submit_reason', 'consented_at', 'started_at', 'expires_at', 'submitted_at',
    ];

    public const REVIEW_FLAGGED = 'flagged';
    public const REVIEW_CLEARED = 'cleared';

    // The teacher's verdict is never sent to students: the student routes return this model
    // as-is. Admin endpoints reveal it explicitly (see SessionReviewController).
    public const REVIEW_FIELDS = ['review_status', 'review_note', 'reviewed_by', 'reviewed_at'];

    protected $hidden = self::REVIEW_FIELDS;

    protected function casts(): array
    {
        return [
            'consented_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'started_at' => 'datetime',
            'expires_at' => 'datetime',
            'submitted_at' => 'datetime',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function violations(): HasMany
    {
        return $this->hasMany(Violation::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
        public function answers(): HasMany
    {
        return $this->hasMany(Answer::class);
    }
    
}