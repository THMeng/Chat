<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ConversationController extends Controller
{
    public function index()
    {
        $userId = Auth::id();

        $conversations = Conversation::whereHas('participants', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })
        ->with([
            'participants:id,name,email,avatar',
            'lastMessage.sender:id,name',
        ])
        ->withCount([
            'messages as unread_count' => function ($q) use ($userId) {
                $q->where('is_read', false)
                  ->where('user_id', '!=', $userId);
            }
        ])
        ->orderByDesc('updated_at')
        ->get()
        ->map(function ($conv) use ($userId) {
            $conv->other_participants = $conv->participants
                ->where('id', '!=', $userId)
                ->values();
            return $conv;
        });

        return response()->json(['conversations' => $conversations]);
    }

    public function createDirect(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id|different:' . Auth::id(),
        ]);

        $authId   = Auth::id();
        $targetId = $request->user_id;

        $existing = Conversation::where('type', 'direct')
            ->whereHas('participants', fn($q) => $q->where('user_id', $authId))
            ->whereHas('participants', fn($q) => $q->where('user_id', $targetId))
            ->with([
                'participants:id,name,email,avatar',
                'lastMessage.sender:id,name',
            ])
            ->withCount([
                'messages as unread_count' => function ($q) use ($authId) {
                    $q->where('is_read', false)
                      ->where('user_id', '!=', $authId);
                }
            ])
            ->first();

        if ($existing) {
            $existing->other_participants = $existing->participants
                ->where('id', '!=', $authId)
                ->values();
            return response()->json(['conversation' => $existing]);
        }

        $conversation = Conversation::create(['type' => 'direct', 'name' => null]);
        $conversation->participants()->attach([$authId, $targetId]);
        $conversation->load('participants:id,name,email,avatar');
        $conversation->other_participants = $conversation->participants
            ->where('id', '!=', $authId)
            ->values();
        $conversation->unread_count = 0;

        return response()->json(['conversation' => $conversation], 201);
    }

    public function createGroup(Request $request)
    {
        $request->validate([
            'name'         => 'required|string|max:100',
            'member_ids'   => 'required|array|min:1',
            'member_ids.*' => 'exists:users,id',
        ]);

        $authId = Auth::id();

        $conversation = Conversation::create([
            'type'   => 'group',
            'name'   => $request->name,
            'avatar' => "https://api.dicebear.com/8.x/initials/svg?seed=" . urlencode($request->name),
        ]);

        $memberIds = array_unique(array_merge($request->member_ids, [$authId]));
        $conversation->participants()->attach($memberIds, ['role' => 'member']);
        $conversation->participants()->updateExistingPivot($authId, ['role' => 'admin']);

        $conversation->load('participants:id,name,email,avatar');
        $conversation->other_participants = $conversation->participants
            ->where('id', '!=', $authId)
            ->values();
        $conversation->unread_count = 0;

        return response()->json(['conversation' => $conversation], 201);
    }

    public function show(Conversation $conversation)
    {
        $userId = Auth::id();

        $isMember = $conversation->participants()
            ->where('user_id', $userId)
            ->exists();

        if (!$isMember) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $conversation->load('participants:id,name,email,avatar');
        $conversation->other_participants = $conversation->participants
            ->where('id', '!=', $userId)
            ->values();

        return response()->json(['conversation' => $conversation]);
    }

    public function addMember(Request $request, Conversation $conversation)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);

        if ($conversation->type !== 'group') {
            return response()->json(['error' => 'Only group conversations support adding members'], 422);
        }

        $conversation->participants()->syncWithoutDetaching([$request->user_id]);

        return response()->json(['message' => 'Member added successfully']);
    }
}