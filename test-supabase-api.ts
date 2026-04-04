async function testSupabaseApi() {
  try {
    const res = await fetch("https://isontzkqfyvhimqsahrt.supabase.co/rest/v1/", {
      headers: {
        "apikey": "test"
      }
    });
    console.log("Supabase API status:", res.status);
    console.log("Response:", await res.text());
  } catch (err) {
    console.error("Supabase API fetch failed:", err);
  }
}
testSupabaseApi();
