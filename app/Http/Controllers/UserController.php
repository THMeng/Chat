<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserController extends Controller
{
    /**
     * Search for users to start a conversation with.
     */
    public function search(Request $request)
    {
        $query = $request->get('q', '');

        $users = User::where('id', '!=', Auth::id())
            ->where(function ($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                  ->orWhere('email', 'like', "%{$query}%");
            })
            ->select('id', 'name', 'email', 'avatar')
            ->limit(20)
            ->get();

        return response()->json(['users' => $users]);
    }

    /**
     * List all users (for new conversation picker).
     */
    public function index()
    {
        $users = User::where('id', '!=', Auth::id())
            ->select('id', 'name', 'email', 'avatar')
            ->orderBy('name')
            ->get();

        return response()->json(['users' => $users]);
    }
}