import net from "net";
const host = "db.isontzkqfyvhimqsahrt.supabase.co";
const ports = [5432, 6543];

ports.forEach(port => {
  const socket = net.connect(port, host, () => {
    console.log(`Port ${port} is OPEN on ${host}`);
    socket.destroy();
  });
  socket.on("error", (err) => {
    console.log(`Port ${port} is CLOSED on ${host}: ${err.message}`);
  });
});
