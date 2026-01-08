
import { CommunityPost, CropPortfolioItem, User } from "../../types";
import { getSupabase, checkSupabaseConnection } from "../supabaseClient";
import { uploadImage } from "../storageService";

export const getCommunityFeed = async (lat: number, lon: number): Promise<CommunityPost[]> => {
    const supabase = getSupabase();
    if (!supabase || !(await checkSupabaseConnection())) return [];
    try {
        const { data } = await supabase.from('community_posts')
            .select('id, content, image_url, likes_count, comments_count, created_at, tags, location, profiles(full_name, avatar_url)')
            .order('created_at', { ascending: false })
            .limit(20);
            
        return data ? data.map((r: any) => ({
            id: r.id, 
            author: r.profiles?.full_name, 
            author_avatar: r.profiles?.avatar_url, 
            author_loc: r.location?.district || 'Nearby',
            content: r.content, 
            image_url: r.image_url, 
            likes: r.likes_count, 
            replies: r.comments_count, 
            timestamp: new Date(r.created_at).toLocaleDateString(), 
            tags: r.tags || []
        })) : [];
    } catch (e) { return []; }
};

export const createCommunityPost = async (user: User, content: string, imageFiles: File[] = [], location?: any, tags?: string[]) => {
    const supabase = getSupabase();
    if (!supabase || !(await checkSupabaseConnection())) return false;

    let uploadedImageUrl = null;
    if (imageFiles.length > 0) {
        uploadedImageUrl = await uploadImage(imageFiles[0], `community/${user.id}`);
    }

    const { error } = await supabase.from('community_posts').insert({ 
        user_id: user.id, 
        content, 
        image_url: uploadedImageUrl, 
        tags, 
        location: user.location || location 
    });
    
    if (error) console.error("Post creation error", error);
    return !error;
};

export const saveCropPortfolio = async (user: User, portfolio: CropPortfolioItem[]) => {
    const supabase = getSupabase();
    if(supabase && (await checkSupabaseConnection())) {
        await supabase.from('profiles').update({ crop_portfolio: portfolio }).eq('id', user.id);
    }
    return { ...user, crop_portfolio: portfolio };
};

export const getCropPortfolio = async (user: User) => {
    const supabase = getSupabase();
    if(supabase && (await checkSupabaseConnection())) {
        try {
            const { data } = await supabase.from('profiles').select('crop_portfolio').eq('id', user.id).single();
            if(data?.crop_portfolio) return data.crop_portfolio;
        } catch (e) {}
    }
    return user.crop_portfolio || [];
};
