import dns from "dns";
dns.resolve4("db.isontzkqfyvhimqsahrt.supabase.co", (err, addresses) => {
  if (err) console.error("DNS resolve4 failed:", err);
  else console.log("IPv4 addresses:", addresses);
});
