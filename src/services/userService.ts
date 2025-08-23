import { supabase } from '@/utils/supabase';

export class UserService {
  static async getProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  }
  
  static async getUserByUsername(username: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();
    return data;
  }
}