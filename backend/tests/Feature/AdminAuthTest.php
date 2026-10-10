<?php

namespace Tests\Feature;

use App\Models\AdminToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    private function teacher(): User
    {
        return User::factory()->create([
            'employee_id' => '2020-0001-MN-0', 'name' => 'Ana Cruz', 'password' => 'correct-horse',
        ]);
    }

    public function test_login_returns_a_working_token(): void
    {
        $this->teacher();

        $token = $this->postJson('/api/admin/login', [
            'employee_id' => '2020-0001-MN-0', 'password' => 'correct-horse',
        ])->assertOk()
            ->assertJsonPath('user.name', 'Ana Cruz')
            ->json('token');

        $this->withToken($token)->getJson('/api/admin/me')
            ->assertOk()->assertJsonPath('employee_id', '2020-0001-MN-0');
        $this->withToken($token)->getJson('/api/exams')->assertOk();
    }

    public function test_login_ignores_case_and_spaces_in_the_id(): void
    {
        $this->teacher();

        $this->postJson('/api/admin/login', [
            'employee_id' => '  2020-0001-mn-0 ', 'password' => 'correct-horse',
        ])->assertOk();
    }

    public function test_wrong_password_or_unknown_id_is_rejected(): void
    {
        $this->teacher();

        $this->postJson('/api/admin/login', [
            'employee_id' => '2020-0001-MN-0', 'password' => 'nope-nope',
        ])->assertUnauthorized();
        $this->postJson('/api/admin/login', [
            'employee_id' => '9999-0000-XX-0', 'password' => 'correct-horse',
        ])->assertUnauthorized();
    }

    public function test_admin_routes_need_a_valid_token(): void
    {
        $this->getJson('/api/exams')->assertUnauthorized();
        $this->withToken('garbage')->getJson('/api/exams')->assertUnauthorized();
    }

    public function test_expired_token_is_rejected(): void
    {
        $user = $this->teacher();
        AdminToken::create([
            'user_id' => $user->id, 'token' => hash('sha256', 'old-token'),
            'expires_at' => now()->subMinute(),
        ]);

        $this->withToken('old-token')->getJson('/api/exams')->assertUnauthorized();
    }

    public function test_logout_invalidates_the_token(): void
    {
        $this->teacher();
        $token = $this->postJson('/api/admin/login', [
            'employee_id' => '2020-0001-MN-0', 'password' => 'correct-horse',
        ])->json('token');

        $this->withToken($token)->postJson('/api/admin/logout')->assertOk();
        $this->withToken($token)->getJson('/api/exams')->assertUnauthorized();
    }

    public function test_student_routes_never_need_a_token(): void
    {
        $this->getJson('/api/exams/code/NOPE12')->assertNotFound();
    }

    public function test_admin_create_command_makes_a_loginable_account(): void
    {
        $this->artisan('admin:create', [
            'employee_id' => '2021-0002-MN-1', 'name' => 'Ben Reyes', '--password' => 'longenough1',
        ])->assertSuccessful();

        $this->postJson('/api/admin/login', [
            'employee_id' => '2021-0002-MN-1', 'password' => 'longenough1',
        ])->assertOk();

        $this->artisan('admin:create', [
            'employee_id' => '2021-0002-MN-1', 'name' => 'Ben Reyes', '--password' => 'short',
        ])->assertFailed();
    }
}