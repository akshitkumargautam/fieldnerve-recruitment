# FieldNerve Vendor Recommendation Platform

This repository contains the implementation of the FieldNerve Vendor Recommendation Platform spec.

## 🚀 Getting Started

The entire implementation is self-contained within the `v1` directory. To get started and test the application, you must navigate into the `v1` folder.

```bash
cd v1
```

## 🛠️ Testing & Running the Application

Inside the `v1` folder, follow these steps to set up the database and start the server:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Initialize Database:**
   *(The project uses a local SQLite database `dev.db` for zero-configuration testing)*
   ```bash
   npx prisma db push
   npx prisma generate
   ```

3. **Seed the Mock Data:**
   *(Populates the DB with the exact 12 vendors and 4 requirements from the spec)*
   ```bash
   npm run seed
   ```

4. **Start the Server:**
   ```bash
   npm run dev
   ```
   *The server will start listening on `http://localhost:3000`.*

## 🧪 Postman Collection

A fully automated Postman collection is provided to test all endpoints as requested.

1. Open Postman.
2. Import the collection file located at: `v1/postman/fieldnerve.postman_collection.json`
3. Run the collection sequentially. Pre-request and test scripts handle ID linking (e.g. `{{vendorId}}`, `{{workReqId}}`) automatically.

---

For a detailed breakdown of the Architecture, Database Design, API Design, Recommendation Logic, and Stated Trade-offs, please read the detailed **[v1/README.md](./v1/README.md)**.
