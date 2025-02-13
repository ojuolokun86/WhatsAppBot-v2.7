const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    prefix: ".",
    botNumber: "2348026977793@s.whatsapp.net",
    adminNumber: "2348051891310@s.whatsapp.net",
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY
};