import dns from "dns";
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.lookup("db.isontzkqfyvhimqsahrt.supabase.co", { family: 4 }, (err, address) => {
  if (err) console.error("DNS lookup failed:", err);
  else console.log("IPv4 address:", address);
});
