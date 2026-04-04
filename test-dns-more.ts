import dns from "dns";
dns.resolve4("google.com", (err, addresses) => {
  if (err) console.error("DNS resolve4 failed for google.com:", err);
  else console.log("google.com IPv4 addresses:", addresses);
});
dns.resolve4("db.isontzkqfyvhimqsahrt.supabase.co", (err, addresses) => {
  if (err) console.error("DNS resolve4 failed for Supabase:", err);
  else console.log("Supabase IPv4 addresses:", addresses);
});
