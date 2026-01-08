
import { ChatMessage, ChatRoom, DiagnosisResponse, User } from "../types";
import { uploadImage } from "./storageService";
import { getSupabase } from "./supabaseClient";

// --- REAL DATABASE SERVICE ---

export const searchFarmers = async (query: string): Promise<User[]> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.error("Supabase client not available");
        return [];
    }

    const safeQuery = (query || '').trim();
    if (!safeQuery) return [];

    console.log("[searchFarmers] Searching for:", safeQuery);

    try {
        // Check if query looks like an email
        const isEmail = safeQuery.includes('@');
        // Check if query looks like a phone number
        const isPhone = /^[\d\+\-\s]+$/.test(safeQuery) && safeQuery.replace(/\D/g, '').length >= 10;
        
        let data: any[] | null = null;
        let error: any = null;
        
        if (isEmail) {
            // For email: try exact match first (case insensitive)
            console.log("[searchFarmers] Email search mode");
            const result = await supabase
                .from('profiles')
                .select('*')
                .ilike('email', safeQuery);
            
            data = result.data;
            error = result.error;
            
            // If no exact match, try partial match
            if ((!data || data.length === 0) && !error) {
                console.log("[searchFarmers] No exact email match, trying partial...");
                const partialResult = await supabase
                    .from('profiles')
                    .select('*')
                    .ilike('email', `%${safeQuery}%`)
                    .limit(15);
                data = partialResult.data;
                error = partialResult.error;
            }
        } else if (isPhone) {
            // Phone number search - clean the number for matching
            const cleanPhone = safeQuery.replace(/\D/g, '');
            console.log("[searchFarmers] Phone search mode, cleaned:", cleanPhone);
            const result = await supabase
                .from('profiles')
                .select('*')
                .or(`phone.ilike.%${cleanPhone}%,phone_number.ilike.%${cleanPhone}%`)
                .limit(15);
            data = result.data;
            error = result.error;
        } else {
            // General search by name, farmer_id, email
            console.log("[searchFarmers] General search mode");
            const result = await supabase
                .from('profiles')
                .select('*')
                .or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,farmer_id.ilike.%${safeQuery}%`)
                .limit(15);
            data = result.data;
            error = result.error;
        }
        
        if (error) {
            console.error("[searchFarmers] Query error:", error);
            // Fallback: try simpler search
            const { data: fallbackData } = await supabase
                .from('profiles')
                .select('*')
                .or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
                .limit(15);
            
            console.log("[searchFarmers] Fallback results:", fallbackData?.length || 0);
            
            if (fallbackData && fallbackData.length > 0) {
                return fallbackData.map((u: any) => ({
                    id: u.id,
                    name: u.full_name || u.name || 'User',
                    email: u.email || '',
                    phone: u.phone_number || u.phone || '',
                    farmer_id: u.farmer_id || '',
                    avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`,
                    role: u.role || 'farmer',
                    usage: u.usage || { scans_this_month: 0, last_reset_date: 0 },
                    location: u.location,
                    crops_grown: u.crops_grown
                }));
            }
            return [];
        }
        
        console.log("[searchFarmers] Results found:", data?.length || 0);
            
        if (data && data.length > 0) {
            return data.map((u: any) => ({
                id: u.id,
                name: u.full_name || u.name || 'User',
                email: u.email || '',
                phone: u.phone_number || u.phone || '',
                farmer_id: u.farmer_id || '',
                avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`,
                role: u.role || 'farmer',
                usage: u.usage || { scans_this_month: 0, last_reset_date: 0 },
                location: u.location,
                crops_grown: u.crops_grown
            }));
        }
        return [];
    } catch (e) { 
        console.error("[searchFarmers] Exception:", e);
        return []; 
    }
};

export const createChatRoom = async (currentUser: User, otherUser: User): Promise<ChatRoom | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
        // 1. Check if 1:1 room already exists between these two users
        const { data: myRooms } = await supabase
            .from('chat_participants')
            .select('room_id')
            .eq('user_id', currentUser.id);

        if (myRooms && myRooms.length > 0) {
            const myRoomIds = myRooms.map(r => r.room_id);
            
            // Check if other user is in any of my rooms (1:1 only)
            const { data: sharedRooms } = await supabase
                .from('chat_participants')
                .select('room_id, chat_rooms!inner(id, is_group)')
                .eq('user_id', otherUser.id)
                .in('room_id', myRoomIds)
                .eq('chat_rooms.is_group', false);

            if (sharedRooms && sharedRooms.length > 0) {
                // Room exists, fetch and return it
                const existingRoomId = sharedRooms[0].room_id;
                const { data: existingRoom } = await supabase
                    .from('chat_rooms')
                    .select('*')
                    .eq('id', existingRoomId)
                    .single();

                if (existingRoom) {
                    console.log("[createChatRoom] Found existing room:", existingRoomId);
                    return {
                        id: existingRoom.id,
                        is_group: false,
                        created_at: new Date(existingRoom.created_at).getTime(),
                        updated_at: new Date(existingRoom.updated_at).getTime(),
                        participants: [currentUser.id, otherUser.id],
                        other_user: otherUser,
                        last_message: existingRoom.last_message,
                        last_message_type: existingRoom.last_message_type,
                        last_message_time: existingRoom.last_message_time ? new Date(existingRoom.last_message_time).getTime() : undefined
                    };
                }
            }
        }

        // 2. Create new Room
        console.log("[createChatRoom] Creating new room for:", currentUser.id, "and", otherUser.id);
        const { data: room, error } = await supabase
            .from('chat_rooms')
            .insert({
                is_group: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error || !room) {
            console.error("[createChatRoom] Failed to create room", error);
            return null;
        }

        // 3. Add Participants (only room_id and user_id - no joined_at column in schema)
        const { error: participantError } = await supabase.from('chat_participants').insert([
            { room_id: room.id, user_id: currentUser.id },
            { room_id: room.id, user_id: otherUser.id }
        ]);

        if (participantError) {
            console.error("[createChatRoom] Failed to add participants", participantError);
        }

        console.log("[createChatRoom] Room created successfully:", room.id);

        return {
            id: room.id,
            is_group: false,
            created_at: new Date(room.created_at).getTime(),
            updated_at: new Date(room.updated_at).getTime(),
            participants: [currentUser.id, otherUser.id],
            other_user: otherUser
        };
    } catch (e) {
        console.error("[createChatRoom] Exception:", e);
        return null;
    }
};

// Create a Group Chat Room with multiple participants
export const createGroupChat = async (
    creator: User, 
    members: User[], 
    groupName: string, 
    groupAvatar?: string
): Promise<ChatRoom | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
        console.log("[createGroupChat] Creating group:", groupName, "with", members.length, "members");

        // 1. Create Group Room
        const { data: room, error } = await supabase
            .from('chat_rooms')
            .insert({
                is_group: true,
                name: groupName,
                group_avatar: groupAvatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${groupName}`,
                description: `Group created by ${creator.name}`,
                created_by: creator.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error || !room) {
            console.error("[createGroupChat] Failed to create group room", error);
            return null;
        }

        // 2. Add all participants (creator + members)
        const allParticipants = [creator, ...members];
        const participantInserts = allParticipants.map(member => ({
            room_id: room.id,
            user_id: member.id,
            is_admin: member.id === creator.id // Creator is admin
        }));

        const { error: participantError } = await supabase
            .from('chat_participants')
            .insert(participantInserts);

        if (participantError) {
            console.error("[createGroupChat] Failed to add participants", participantError);
        }

        // 3. Send system message about group creation
        await supabase.from('chat_messages').insert({
            room_id: room.id,
            sender_id: creator.id,
            content: `${creator.name} created group "${groupName}"`,
            type: 'system',
            created_at: new Date().toISOString(),
            read_by: [creator.id]
        });

        console.log("[createGroupChat] Group created successfully:", room.id);

        return {
            id: room.id,
            is_group: true,
            name: groupName,
            group_avatar: room.group_avatar,
            description: room.description,
            created_at: new Date(room.created_at).getTime(),
            updated_at: new Date(room.updated_at).getTime(),
            participants: allParticipants.map(p => p.id),
            unread_count: 0
        };
    } catch (e) {
        console.error("[createGroupChat] Exception:", e);
        return null;
    }
};

// Get group members
export const getGroupMembers = async (roomId: string): Promise<User[]> => {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
        const { data } = await supabase
            .from('chat_participants')
            .select(`
                user_id,
                is_admin,
                profiles (
                    id,
                    full_name,
                    avatar_url,
                    phone_number,
                    email,
                    farmer_id,
                    role
                )
            `)
            .eq('room_id', roomId);

        if (!data) return [];

        return data.map((p: any) => ({
            id: p.user_id,
            name: p.profiles?.full_name || 'User',
            avatar: p.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.user_id}`,
            phone: p.profiles?.phone_number || '',
            email: p.profiles?.email || '',
            farmer_id: p.profiles?.farmer_id || '',
            role: p.profiles?.role || 'farmer',
            usage: { scans_this_month: 0, last_reset_date: 0 },
            isAdmin: p.is_admin
        }));
    } catch (e) {
        console.error("[getGroupMembers] Exception:", e);
        return [];
    }
};

// Add member to group
export const addMemberToGroup = async (roomId: string, newMember: User, addedBy: User): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
        // Add participant
        const { error } = await supabase.from('chat_participants').insert({
            room_id: roomId,
            user_id: newMember.id,
            is_admin: false
        });

        if (error) {
            console.error("[addMemberToGroup] Failed", error);
            return false;
        }

        // Send system message
        await supabase.from('chat_messages').insert({
            room_id: roomId,
            sender_id: addedBy.id,
            content: `${addedBy.name} added ${newMember.name} to the group`,
            type: 'system',
            created_at: new Date().toISOString(),
            read_by: [addedBy.id]
        });

        return true;
    } catch (e) {
        console.error("[addMemberToGroup] Exception:", e);
        return false;
    }
};

// Leave group
export const leaveGroup = async (roomId: string, user: User): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
        // Remove participant
        const { error } = await supabase
            .from('chat_participants')
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', user.id);

        if (error) {
            console.error("[leaveGroup] Failed", error);
            return false;
        }

        // Send system message
        await supabase.from('chat_messages').insert({
            room_id: roomId,
            sender_id: user.id,
            content: `${user.name} left the group`,
            type: 'system',
            created_at: new Date().toISOString(),
            read_by: []
        });

        return true;
    } catch (e) {
        console.error("[leaveGroup] Exception:", e);
        return false;
    }
};

// Mock chats with messages for demo purposes
const getMockChats = (userId: string): ChatRoom[] => [
    {
        id: 'mock-chat-1',
        is_group: false,
        created_at: Date.now() - 3600000,
        updated_at: Date.now() - 300000,
        participants: [userId, 'farmer-1'],
        other_user: {
            id: 'farmer-1',
            name: 'Rajesh Kumar',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rajesh',
            phone: '+91 98765 43210',
            farmer_id: 'FR001',
            role: 'farmer',
            usage: { scans_this_month: 5, last_reset_date: Date.now() }
        },
        last_message: 'Bhai, tomato ka rate kya chal raha hai aaj?',
        last_message_type: 'text',
        last_message_time: Date.now() - 300000,
        unread_count: 2
    },
    {
        id: 'mock-chat-2',
        is_group: false,
        created_at: Date.now() - 86400000,
        updated_at: Date.now() - 1800000,
        participants: [userId, 'farmer-2'],
        other_user: {
            id: 'farmer-2',
            name: 'Sunita Devi',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sunita',
            phone: '+91 87654 32109',
            farmer_id: 'FR002',
            role: 'farmer',
            usage: { scans_this_month: 8, last_reset_date: Date.now() }
        },
        last_message: 'Mere gehu mein bimari aa gayi, photo bhej rahi hu',
        last_message_type: 'text',
        last_message_time: Date.now() - 1800000,
        unread_count: 1
    }
];

// Mock messages for demo chats
const mockMessagesData: Record<string, ChatMessage[]> = {
    'mock-chat-1': [
        {
            id: 'msg-1-1',
            room_id: 'mock-chat-1',
            sender_id: 'farmer-1',
            content: 'Namaste bhai! Kaise ho?',
            type: 'text',
            created_at: Date.now() - 3600000,
            read_by: ['farmer-1'],
            status: 'read'
        },
        {
            id: 'msg-1-2',
            room_id: 'mock-chat-1',
            sender_id: 'current-user',
            content: 'Theek hu bhai, aap batao',
            type: 'text',
            created_at: Date.now() - 3500000,
            read_by: ['current-user', 'farmer-1'],
            status: 'read'
        },
        {
            id: 'msg-1-3',
            room_id: 'mock-chat-1',
            sender_id: 'farmer-1',
            content: 'Sab badhiya! Aaj mandi mein tomato ka rate kaisa hai?',
            type: 'text',
            created_at: Date.now() - 3000000,
            read_by: ['farmer-1'],
            status: 'read'
        },
        {
            id: 'msg-1-4',
            room_id: 'mock-chat-1',
            sender_id: 'current-user',
            content: 'Aaj 25-30 rupye kg chal raha hai',
            type: 'text',
            created_at: Date.now() - 2500000,
            read_by: ['current-user', 'farmer-1'],
            status: 'read'
        },
        {
            id: 'msg-1-5',
            room_id: 'mock-chat-1',
            sender_id: 'farmer-1',
            content: 'Bhai, tomato ka rate kya chal raha hai aaj?',
            type: 'text',
            created_at: Date.now() - 300000,
            read_by: ['farmer-1'],
            status: 'delivered'
        }
    ],
    'mock-chat-2': [
        {
            id: 'msg-2-1',
            room_id: 'mock-chat-2',
            sender_id: 'farmer-2',
            content: 'Namaste! Mujhe gehu ki fasal mein madad chahiye',
            type: 'text',
            created_at: Date.now() - 86400000,
            read_by: ['farmer-2'],
            status: 'read'
        },
        {
            id: 'msg-2-2',
            room_id: 'mock-chat-2',
            sender_id: 'current-user',
            content: 'Haan zaroor batao, kya problem hai?',
            type: 'text',
            created_at: Date.now() - 86000000,
            read_by: ['current-user', 'farmer-2'],
            status: 'read'
        },
        {
            id: 'msg-2-3',
            room_id: 'mock-chat-2',
            sender_id: 'farmer-2',
            content: 'Pattiyan peeli ho rahi hai, koi bimari lag rahi hai shayad',
            type: 'text',
            created_at: Date.now() - 85000000,
            read_by: ['farmer-2'],
            status: 'read'
        },
        {
            id: 'msg-2-4',
            room_id: 'mock-chat-2',
            sender_id: 'current-user',
            content: 'Photo bhejo, main app se diagnose karwa deta hu',
            type: 'text',
            created_at: Date.now() - 84000000,
            read_by: ['current-user', 'farmer-2'],
            status: 'read'
        },
        {
            id: 'msg-2-5',
            room_id: 'mock-chat-2',
            sender_id: 'farmer-2',
            content: 'Mere gehu mein bimari aa gayi, photo bhej rahi hu',
            type: 'text',
            created_at: Date.now() - 1800000,
            read_by: ['farmer-2'],
            status: 'delivered'
        }
    ]
};

export const getMyChats = async (userId: string, retryCount: number = 0): Promise<ChatRoom[]> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.log("[getMyChats] No supabase client, returning cached/mock data");
        return getMockChats(userId);
    }

    // Check if we're online
    if (!navigator.onLine) {
        console.log("[getMyChats] Offline - returning cached data");
        const cached = localStorage.getItem(`chats_${userId}`);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    try {
        console.log("[getMyChats] Fetching chats for user:", userId);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        // 1. Get Room IDs where I am a participant (including unread count)
        const { data: participations, error: partError } = await supabase
            .from('chat_participants')
            .select('room_id, unread_count')
            .eq('user_id', userId)
            .abortSignal(controller.signal);
        
        clearTimeout(timeoutId);

        if (partError) {
            console.error("[getMyChats] Error fetching participations:", partError);
            
            // Retry logic for network errors (max 2 retries)
            if (partError.message?.includes('Network') && retryCount < 2) {
                console.log("[getMyChats] Retrying due to network error... Attempt:", retryCount + 1);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
                return getMyChats(userId, retryCount + 1);
            }
            
            // Return empty array on error instead of mock data
            return [];
        }

        if (!participations || participations.length === 0) {
            console.log("[getMyChats] No chats found in database, returning empty array");
            // Return empty array instead of mock data so user can start fresh chats
            return [];
        }

        // Create a map of room_id -> unread_count
        const unreadCountMap: Record<string, number> = {};
        participations.forEach(p => {
            unreadCountMap[p.room_id] = p.unread_count || 0;
        });

        const roomIds = participations.map(p => p.room_id);
        console.log("[getMyChats] Found", roomIds.length, "rooms");

        // 2. Fetch Rooms details
        const { data: rooms, error: roomError } = await supabase
            .from('chat_rooms')
            .select('*')
            .in('id', roomIds)
            .order('updated_at', { ascending: false });

        if (roomError) {
            console.error("[getMyChats] Error fetching rooms:", roomError);
            return [];
        }

        if (!rooms || rooms.length === 0) {
            console.log("[getMyChats] No room details found");
            return [];
        }

        // 3. Enrich rooms with participant info
        const enrichedRooms: ChatRoom[] = [];

        for (const room of rooms) {
            let otherUser = undefined;
            let participants: string[] = [userId];
            let memberCount = 1;

            if (room.is_group) {
                // For groups, get member count
                const { data: groupMembers } = await supabase
                    .from('chat_participants')
                    .select('user_id')
                    .eq('room_id', room.id);
                
                if (groupMembers) {
                    participants = groupMembers.map(m => m.user_id);
                    memberCount = groupMembers.length;
                }
            } else {
                // For 1:1 chats, get the other user's info
                const { data: others } = await supabase
                    .from('chat_participants')
                    .select(`
                        user_id, 
                        profiles (
                            id,
                            full_name, 
                            avatar_url, 
                            phone_number, 
                            email,
                            role,
                            farmer_id
                        )
                    `)
                    .eq('room_id', room.id)
                    .neq('user_id', userId)
                    .single();
                
                if (others && others.profiles) {
                    const profile = others.profiles as any;
                    otherUser = {
                        id: others.user_id,
                        name: profile.full_name || 'User',
                        avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${others.user_id}`,
                        phone: profile.phone_number || '',
                        email: profile.email || '',
                        role: profile.role || 'farmer',
                        farmer_id: profile.farmer_id || '',
                        usage: { scans_this_month: 0, last_reset_date: 0 }
                    };
                    participants.push(others.user_id);
                }
            }

            enrichedRooms.push({
                id: room.id,
                is_group: room.is_group,
                name: room.is_group ? room.name : undefined,
                group_avatar: room.group_avatar,
                description: room.description,
                last_message: room.last_message,
                last_message_type: room.last_message_type,
                last_message_time: room.last_message_time ? new Date(room.last_message_time).getTime() : undefined,
                created_at: new Date(room.created_at).getTime(),
                updated_at: new Date(room.updated_at).getTime(),
                participants: participants,
                other_user: otherUser,
                member_count: room.is_group ? memberCount : undefined,
                unread_count: unreadCountMap[room.id] || 0
            });
        }

        console.log("[getMyChats] Returning", enrichedRooms.length, "enriched rooms");
        
        // Cache successful result for offline access
        try {
            localStorage.setItem(`chats_${userId}`, JSON.stringify(enrichedRooms));
        } catch (e) {
            console.warn("[getMyChats] Failed to cache chats");
        }
        
        return enrichedRooms;

    } catch (e: any) {
        console.error("[getMyChats] Exception:", e);
        
        // Retry on network errors
        if ((e.message?.includes('Network') || e.message?.includes('abort') || e.name === 'AbortError') && retryCount < 2) {
            console.log("[getMyChats] Retrying after exception... Attempt:", retryCount + 1);
            await new Promise(resolve => setTimeout(resolve, 1500 * (retryCount + 1)));
            return getMyChats(userId, retryCount + 1);
        }
        
        // Return cached data on error
        const cached = localStorage.getItem(`chats_${userId}`);
        if (cached) {
            try {
                console.log("[getMyChats] Returning cached data due to error");
                return JSON.parse(cached);
            } catch (parseErr) {
                return [];
            }
        }
        
        return [];
    }
};

export const getMessages = async (roomId: string, currentUserId?: string): Promise<ChatMessage[]> => {
    // Return mock messages for mock chats
    if (roomId.startsWith('mock-chat-')) {
        const mockMessages = mockMessagesData[roomId] || [];
        // Replace 'current-user' with actual user ID for proper left/right alignment
        if (currentUserId) {
            return mockMessages.map(msg => ({
                ...msg,
                sender_id: msg.sender_id === 'current-user' ? currentUserId : msg.sender_id
            }));
        }
        return mockMessages;
    }

    const supabase = getSupabase();
    if (!supabase) return [];

    const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

    if (!data) return [];

    return data.map((msg: any) => ({
        id: msg.id,
        room_id: msg.room_id,
        sender_id: msg.sender_id,
        content: msg.content,
        type: msg.type,
        media_url: msg.media_url,
        media_duration: msg.media_duration,
        report_data: msg.report_data,
        created_at: new Date(msg.created_at).getTime(),
        read_by: msg.read_by || [],
        status: 'read'
    }));
};

export const sendMessage = async (
    roomId: string, 
    senderId: string, 
    content: string, 
    type: 'text' | 'image' | 'video' | 'audio' | 'report' | 'document' | 'location' = 'text', 
    file?: File,
    replyTo?: ChatMessage,
    reportData?: DiagnosisResponse
): Promise<ChatMessage | null> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.error("[sendMessage] Supabase not available");
        return null;
    }

    console.log("[sendMessage] Sending message to room:", roomId, "from:", senderId);

    let mediaUrl = undefined;
    if (file) {
        // Upload
        const uploaded = await uploadImage(file, `chats/${roomId}`);
        if (uploaded) mediaUrl = uploaded;
    }

    const payload = {
        room_id: roomId,
        sender_id: senderId,
        content: content,
        type: type,
        media_url: mediaUrl,
        report_data: reportData ? {
            title: reportData.disease_name_en,
            severity: reportData.severity,
            diagnosisId: reportData.diagnosis_id,
            imageUrl: reportData.imageUrl
        } : null,
        created_at: new Date().toISOString(),
        read_by: [senderId]
    };

    console.log("[sendMessage] Payload:", payload);

    const { data, error } = await supabase
        .from('chat_messages')
        .insert(payload)
        .select()
        .single();

    if (error || !data) {
        console.error("[sendMessage] Failed to insert message:", error);
        return null;
    }

    console.log("[sendMessage] Message inserted:", data.id);

    // Update Room Last Message
    const lastMsgPreview = type === 'text' ? content : 
                          type === 'location' ? '📍 Location' :
                          type === 'image' ? '📷 Photo' :
                          type === 'video' ? '🎥 Video' :
                          type === 'audio' ? '🎤 Voice message' :
                          type === 'document' ? '📄 Document' :
                          type === 'report' ? '📋 Report' :
                          `Sent a ${type}`;
    
    const { error: updateError } = await supabase
        .from('chat_rooms')
        .update({
            last_message: lastMsgPreview,
            last_message_type: type,
            last_message_time: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', roomId);

    if (updateError) {
        console.error("[sendMessage] Failed to update room:", updateError);
    } else {
        console.log("[sendMessage] Room updated with last message");
    }

    return {
        id: data.id,
        room_id: data.room_id,
        sender_id: data.sender_id,
        content: data.content,
        type: data.type,
        media_url: data.media_url,
        report_data: data.report_data,
        created_at: new Date(data.created_at).getTime(),
        read_by: data.read_by,
        status: 'sent'
    };
};

// Reset unread count when user opens a chat
export const markChatAsRead = async (roomId: string, userId: string): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('chat_participants')
            .update({ unread_count: 0 })
            .eq('room_id', roomId)
            .eq('user_id', userId);

        if (error) {
            console.error("[markChatAsRead] Error:", error);
        } else {
            console.log("[markChatAsRead] Chat marked as read");
        }
    } catch (e) {
        console.error("[markChatAsRead] Exception:", e);
    }
};

export const blockUser = async (currentUserId: string, targetUserId: string, shouldBlock: boolean = true) => {
    console.log(`${shouldBlock ? 'Blocked' : 'Unblocked'} user ${targetUserId} by ${currentUserId}`);
    // TODO: Implement actual block functionality with Supabase
    // This would typically add/remove from a blocked_users table
    return true;
};
