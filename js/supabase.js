const SUPABASE_URL = "https://okqqzqcysnsesslzbrmf.supabase.co";

const SUPABASE_KEY = "sb_publishable_7EyxsGI_5WSrq8G1_Wt6vQ_zV-eF1xR";

const { createClient } = supabase;

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

window.db = db;

console.log("Cliente de Supabase inicializado");
