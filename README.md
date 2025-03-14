# Sekai-Translate

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)  [![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)  [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

这个项目的 **99%** 代码都是 `claude` 写的。

我本人完全不懂 Web 开发。

## TODOLIST

- [ ] ~~Tag模糊搜索，感觉要建立一个全局字典，还得大改GlobalSearch这个组件。呃啊~~弃用
- [x] 人名模糊搜索
- [x] 多Tag
- [ ] 用户系统？（感觉可以考虑接一个白名单，拿QQ的接口登录。但，毕竟理论上只需要一个账户拥有写权限。）
- [ ] 如果做用户系统的话，还要存登录状态，这个应该是用 `localStorage` 存一个 `token` 就好了。
- [x] 人名检索完成
- [ ] 设置页面，感觉要放的设置也就白天/黑夜模式。
- [x] 桌面端，用 `tauri` 打包。
- [ ] 人名检索折叠
- [ ] 两个搜索的tag样式和触发都有问题得修