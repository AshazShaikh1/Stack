# 🏗️ System Architecture & Boundaries

This project follows a strict **Data Access Layer (DAL)** pattern to decouple the UI from the database backend (Supabase).

## 🚫 The Golden Rule
**NEVER import `createClient` or `supabase` directly in UI components or API routes.**

### ❌ Incorrect
```typescript
// src/app/page.tsx
import { createClient } from "@/lib/supabase/server"; // 🚨 Linter Error!

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from('cards').select();
}

✅ Correct

// src/app/page.tsx
import { db } from "@/lib/data"; // 🟢 Allowed

export default async function Page() {
  const cards = await db.cards.getTrending();
}

🔄 How to Modify Data Logic
Modify the Interface: Update src/lib/data/types.ts to define the new method.

Implement the Adapter: Update src/lib/data/adapters/supabase.ts to implement the logic.

Export: Ensure it's exposed via src/lib/data/index.ts.

Use: Import db in your component.

🛠️ Future Proofing
This structure allows us to swap Supabase for GraphQL, Firebase, or a custom REST API in 1 day by simply writing a new adapter in src/lib/data/adapters/ and switching the export in index.ts.
---

### **3. Folder Rules (Mental Model)**

You don't need a script for this, just a discipline. Stick to this mental map:

1.  **`src/components/*`**: Pure UI. Should receive data as **props** mostly. If they fetch, they use `useSWR` or Server Actions that call `db`.
2.  **`src/app/api/*`**: validation -> `db` call -> response. No complex SQL logic here.
3.  **`src/lib/data/*`**: The "Brain". All SQL/Supabase logic lives here.

### **What Next?**

1.  **Run Lint:** `npm run lint`.
    * You will see a wall of **warnings**. This is your "To-Do List" for refactoring.
2.  **Refactor:** As you proceed with the refactoring you planned, watch the warnings disappear.
3.  **Lockdown:** Once `npm run lint` is clean, change `"warn"` to `"error"` in `.eslintrc.json`.

Phase 6 is now complete. Your app is architecturally mature and protected against technical debt.