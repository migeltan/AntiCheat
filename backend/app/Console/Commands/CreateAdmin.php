<?php

namespace App\Console\Commands;

use App\Models\AdminToken;
use App\Models\User;
use Illuminate\Console\Command;

class CreateAdmin extends Command
{
    protected $signature = 'admin:create
        {employee_id : Teacher ID, e.g. 2020-0001-MN-0}
        {name : Full name, in quotes}
        {--password= : Leave out to be asked (hidden)}';

    protected $description = 'Create a teacher account, or reset its password if the ID already exists';

    public function handle(): int
    {
        $id = strtoupper(trim($this->argument('employee_id')));

        if (! preg_match('/^[A-Z0-9][A-Z0-9-]{2,49}$/', $id)) {
            $this->error('The ID may only contain letters, numbers and dashes (3 to 50 characters).');

            return self::FAILURE;
        }

        $password = (string) ($this->option('password') ?: $this->secret('Password (at least 8 characters)'));

        if (strlen($password) < 8) {
            $this->error('The password must be at least 8 characters.');

            return self::FAILURE;
        }

        $user = User::where('employee_id', $id)->first();

        if ($user) {
            $user->update(['name' => $this->argument('name'), 'password' => $password]);
            AdminToken::where('user_id', $user->id)->delete(); // sign out everywhere
            $this->info("Updated {$id}: password reset, signed out everywhere.");
        } else {
            User::create(['employee_id' => $id, 'name' => $this->argument('name'), 'password' => $password]);
            $this->info("Created {$id}.");
        }

        return self::SUCCESS;
    }
}