async function getIPv4() {
  const host = "db.isontzkqfyvhimqsahrt.supabase.co";
  try {
    const res = await fetch(`https://dns.google/resolve?name=${host}&type=AAAA`);
    const data = await res.json();
    if (data.Answer) {
      console.log("IPv4 addresses:", data.Answer.map(a => a.data));
    } else {
      console.log("No IPv4 address found via DoH");
    }
  } catch (err) {
    console.error("DoH failed:", err);
  }
}
getIPv4();
