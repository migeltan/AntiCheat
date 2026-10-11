<?php

namespace App\Http\Controllers;

use App\Models\AdminToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminAuthController extends Controller
{
    private const TOKEN_HOURS = 12;

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => 'required|string|max:50',
            'password' => 'required|string|max:255',
        ]);

        $user = User::where('employee_id', strtoupper(trim($data['employee_id'])))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Incorrect ID or password.'], 401);
        }

        AdminToken::where('user_id', $user->id)->where('expires_at', '<', now())->delete();

        $plain = Str::random(60);
        AdminToken::create([
            'user_id' => $user->id,
            'token' => hash('sha256', $plain),
            'expires_at' => now()->addHours(self::TOKEN_HOURS),
        ]);

        return response()->json(['token' => $plain, 'user' => $this->present($user)]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->present($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->attributes->get('admin_token')?->delete();

        return response()->json(['ok' => true]);
    }

    private function present(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'employee_id' => $user->employee_id];
    }
}