# /baseline-audit - 代码基线审计

执行以下操作：
1. 读取根目录 `package.json` 和 `pnpm-lock.yaml`，提取 React、Vite、Cesium、Fastify、Prisma 的版本。
2. 检查 `apps/web/src/router.tsx` 列出所有现有路由。
3. 检查 `prisma/schema.prisma` 列出所有现有 Model。
4. 输出一份 `docs/current-baseline.md` 对比文档，标出“文档有但代码没有”和“代码有但文档没提”的部分。
5. **结论**：明确写出“哪些现有代码可以复用，不重写”。