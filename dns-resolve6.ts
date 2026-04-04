import dns from "dns";
dns.resolve6("db.isontzkqfyvhimqsahrt.supabase.co", (err, addresses) => {
  if (err) console.error("DNS resolve6 failed:", err);
  else console.log("IPv6 addresses:", addresses);
});
