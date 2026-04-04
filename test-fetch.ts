async function testFetch() {
  try {
    const res = await fetch("https://api.github.com/zen");
    console.log("Fetch status:", res.status);
    console.log("Response:", await res.text());
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
testFetch();
