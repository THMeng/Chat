<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Support\Facades\Auth;

class MessageController extends Controller
{
    public function index(Request $request, $conversationId)
    {
        $conversation = Conversation::findOrFail($conversationId);

        $isMember = $conversation->participants()
            ->where('user_id', Auth::id())
            ->exists();

        if (!$isMember) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $messages = Message::where('conversation_id', $conversationId)
            ->with('sender:id,name,avatar')
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 30));

        return response()->json([
            'messages'  => $messages->items(),
            'has_more'  => $messages->hasMorePages(),
            'next_page' => $messages->currentPage() + 1,
            'total'     => $messages->total(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'conversation_id' => 'required|integer|exists:conversations,id',
            'content'         => 'required|string|max:5000',
            'type'            => 'nullable|in:text,image,file',
        ]);

        $conversation = Conversation::findOrFail($validated['conversation_id']);

        $isMember = $conversation->participants()
            ->where('user_id', Auth::id())
            ->exists();

        if (!$isMember) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $message = Message::create([
            'conversation_id' => $validated['conversation_id'],
            'user_id'         => Auth::id(),
            'content'         => $validated['content'],
            'type'            => $validated['type'] ?? 'text',
            'is_read'         => false,
        ]);

        $conversation->touch();
        $message->load('sender:id,name,avatar');

        return response()->json(['message' => $message], 201);
    }

    public function markRead(Message $message)
{
    // Only mark as read if message belongs to someone else
    if ($message->user_id !== Auth::id()) {
        $message->update(['is_read' => true]);

        // Also mark all previous messages in same conversation as read
        Message::where('conversation_id', $message->conversation_id)
            ->where('user_id', '!=', Auth::id())
            ->where('is_read', false)
            ->where('id', '<=', $message->id)
            ->update(['is_read' => true]);
    }

    return response()->json(['success' => true]);
}

    public function destroy(Message $message)
    {
        if ($message->user_id !== Auth::id()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }
        $message->update(['content' => 'This message was deleted', 'type' => 'deleted']);
        return response()->json(['message' => 'Deleted']);
    }
}