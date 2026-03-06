import app from "./app.js"
import dotenv from "dotenv"
import connectDB from "./src/Database/ConnectDb.js"

dotenv.config()

const PORT = process.env.PORT || 8000

const startServer = async () => {
  try {
    await connectDB()
    app.listen(PORT, () => {
      console.log(`[server] Running on port ${PORT}`)
    })
  } catch (err) {
    console.error("[server] Failed to start:", err.message)
    process.exit(1)
  }
}
startServer()
