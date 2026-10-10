<?php

namespace Tests\Concerns;

use App\Models\AdminToken;
use App\Models\User;
use Illuminate\Support\Str;

trait SignsInAsAdmin
{
    protected function signInAsAdmin(): User
    {
        $user = User::factory()->create(['employee_id' => '2020-0001-MN-0']);
        $plain = Str::random(60);

        AdminToken::create([
            'user_id' => $user->id,
            'token' => hash('sha256', $plain),
            'expires_at' => now()->addHour(),
        ]);

        $this->withToken($plain);

        return $user;
    }
}