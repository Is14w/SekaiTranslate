# Sekai-Translate

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/) [![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/) [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/) [![Tauri](https://img.shields.io/badge/Tauri-000000?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.studio/) [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Deno](https://img.shields.io/badge/Deno-000000?style=for-the-badge&logo=deno&logoColor=white)](https://deno.land/)

这个项目的 **99%** 代码都是 `claude` 写的。

**大家几乎都不懂 Web 开发。**

## TODOLIST

- [x] 人名模糊搜索
- [x] 多 Tag
- [x] 用户系统
- [x] 如果做用户系统的话，还要存登录状态，这个应该是用 `localStorage` 存一个 `token` 就好了。
- [x] 人名检索完成
- [x] 设置页面，感觉要放的设置也就白天/黑夜模式。
- [x] 桌面端，用 `tauri` 打包。
- [x] 人名检索折叠
- [x] 把静态 json 逻辑改成从 Deno 数据库拿
- [ ] jsontable 现在修改键值对只可以在已有的改，得加上新键值对的功能
- [ ] jsontable 现在直接这么看太乱了，得给 tag 加上优先级（就按现成的 0，1，2），然后再做一个子显示，然后把显示 tag 的列删了
- [ ] 人名检索需要一个隐藏的 tag，表明是红字还是黄字什么什么的
- [ ] 两个搜索的 tag 样式和触发都有问题得修
