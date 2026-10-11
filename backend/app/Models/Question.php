<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    public const TYPES = ['multiple_choice', 'checkboxes', 'short_answer', 'paragraph'];
    public const CHOICE_TYPES = ['multiple_choice', 'checkboxes'];

    protected $fillable = ['exam_id', 'position', 'type', 'prompt', 'options', 'required', 'correct_answer'];

    // The answer key must never reach students: the student routes return raw
    // Question models. Admin endpoints reveal it with makeVisible('correct_answer').
    protected $hidden = ['correct_answer'];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'correct_answer' => 'array',
            'required' => 'boolean',
        ];
    }
}