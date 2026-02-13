
# ProjectFlow User Guide / 用户指南

Welcome to ProjectFlow! This guide will help you get started with managing your projects, tracking time, and visualizing your progress.

欢迎使用 ProjectFlow！本指南将帮助您开始管理项目、跟踪时间并可视化您的进度。

---

## Language / 语言

- [English Version](#english-version)
- [中文版 (Chinese Version)](#chinese-version)

---

<a id="english-version"></a>
## English Version

### 1. Getting Started
ProjectFlow is designed to handle complex projects (like academic thesis, software development, or long-term goals) by breaking them down into manageable hierarchies.

#### Creating a New Project
1.  Click the **+ New Project** button in the top right corner.
2.  Enter your **Project Name** (e.g., "PhD Thesis").
3.  (Optional) Add a description, set a final deadline, and define your daily work capacity (e.g., 2 hours/day).
4.  Choose a template (Academic or Blank) to pre-fill tasks or start fresh.

### 2. Project Hierarchy
The system uses a 4-level hierarchy to organize work:
1.  **Project:** The main container (e.g., "My Thesis").
2.  **Version:** Major milestones or drafts (e.g., "Draft 1", "Final Revision"). You can create multiple versions to track iterations.
3.  **Task Category:** High-level phases (e.g., "Literature Review", "Data Analysis").
4.  **Subtask:** The actual actionable items (e.g., "Read papers on X", "Write Python script"). **This is where you log time.**

### 3. Managing Tasks & Deadlines (DDL)
*   **Renaming:** Click on any title (Version, Task, or Subtask) to rename it inline.
*   **Deadlines (DDL):**
    *   Click on **"Set End"** or the date text next to any item to set a start and end date.
    *   If a task is overdue, the date will turn red.
*   **Notes:** Click the **Notes** button (or document icon) to add detailed remarks or memos to any level of the hierarchy.
*   **Project Todo List:**
    *   **Pin Subtasks:** Click the **List/Todo Icon** on a subtask to add it to the Project Todo List on the right panel. The completion status is synced both ways.
    *   **Quick Adds:** You can also add standalone todo items directly in the list for quick access.

### 4. Tracking Time (Work Logs)
To track your work on a **Subtask**:
*   **Manual Entry:** Click the **Clipboard Icon** next to a subtask to open the Work Log modal. Here you can manually input date, duration, focus level, and detailed reflection (goals, outputs, problems).

**Review & Aggregation:**
*   **Log History:** When adding a log, switch to the "History" tab to view and edit all past entries for that subtask.
*   **Calendar:** Click the **Calendar** button in the top bar. This provides a heatmap of your activity. Click on a day to see a breakdown of time spent, colored by project folder.
*   **Done Timeline:** Click "Done Timeline" to see a chronological feed of all subtasks you have completed across all projects.

### 5. Visualization
*   **Timeline:** Shows a forecast of your work based on remaining estimated hours vs. your daily capacity. Green blocks are history, Blue blocks are future plans.
*   **Analytics:** The pie charts and bar charts update automatically as you log time, showing "Planned vs. Actual" progress.

### 6. Extra Features
*   **Wishlist:** A place for loose ideas or long-term goals.
    *   **Deadlines:** Set flexible deadlines (End of Month/Year, Long Term) or specific dates.
    *   **Annotations:** Add timestamped notes or thoughts to any item.
    *   **Tracker Table:** Enable the "Tracker" to create a custom grid for monitoring metrics or progress over time (with history comparison).
*   **Daily Log (Schedule):** On the left sidebar (in Dashboard view), you can manage daily non-project tasks.
    *   **Navigation:** Click the date number to jump to a specific date.
    *   **Task Actions:** Click the circle once to mark as **Complete**. Click it again (when completed) to mark as **Abandoned** (you can provide a reason in the popup).
    *   **DDLs Off/On:** Toggle this button to show or hide deadlines from your projects mixed into your daily timeline.

### 7. Deployment & Online Usage
**Live Access:** [https://thesisflowai.pages.dev/](https://thesisflowai.pages.dev/)

**⚠️ Important Data Notice:**
*   All data is stored **locally in your browser** (Local Storage). We do not have a backend server.
*   **Backup Daily:** If the website is updated or your browser cache is cleared, **your data may be lost**. It is highly recommended to use the **Backup** button (top right) to download a JSON snapshot of your data every day.

**How to Deploy to Cloudflare Pages (Self-Hosting Recommended):**
For better control over your version, you can deploy this yourself:
1.  **Fork** this repository to your GitHub account.
2.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Pages**.
3.  Click **Connect to Git** and select your forked repository.
4.  Configure the build settings:
    *   **Framework Preset:** `Vite`
    *   **Build Command:** `npm run build`
    *   **Output Directory:** `dist`
5.  Click **Save and Deploy**.

---

<a id="chinese-version"></a>
## 中文版 (Chinese Version)

### 1. 快速开始
ProjectFlow 旨在通过将复杂项目（如学术论文、软件开发或长期目标）分解为可管理的层级来帮助您进行管理。

#### 新建项目
1.  点击右上角的 **+ New Project** (新建项目) 按钮。
2.  输入 **项目名称** (例如 "博士论文")。
3.  (可选) 添加描述，设置最终截止日期 (DDL)，并定义每日工作容量 (例如每天 2 小时)。
4.  选择一个模板 (Academic 学术模板或 Blank 空白模板) 来预填充任务或从头开始。

### 2. 项目层级
系统使用 4 级层级来组织工作：
1.  **Project (项目):** 主容器 (例如 "我的论文")。
2.  **Version (版本):** 主要里程碑或草稿 (例如 "初稿", "最终修订")。您可以创建多个版本来跟踪迭代。
3.  **Task (任务/分类):** 高级阶段 (例如 "文献综述", "数据分析")。
4.  **Subtask (子任务):** 实际的可执行项 (例如 "阅读关于X的论文", "编写Python脚本")。**这是您记录时间的地方。**

### 3. 管理任务与截止日期 (DDL)
*   **重命名:** 点击任何标题 (版本、任务或子任务) 即可进行行内重命名。
*   **截止日期 (DDL):**
    *   点击任何项目旁边的 **"Set End"** 或日期文本，设置开始和结束日期。
    *   如果任务逾期，日期将变为红色。
*   **备注 (Notes):** 点击 **Notes** 按钮 (或文档图标) 为层级的任何部分添加详细备注或备忘录。
*   **Project Todo List (项目待办列表):**
    *   **固定子任务:** 点击子任务上的 **列表/待办图标** 将其添加到项目待办列表。完成状态是双向同步的。
    *   **快速添加:** 您也可以直接在列表中添加独立的待办事项。

### 4. 记录时间 (工作日志)
记录 **子任务** 工作的方法：
*   **手动输入:** 点击子任务旁边的 **剪贴板图标** 打开工作日志弹窗。在这里，您可以手动输入日期、持续时间、专注度以及详细的反思 (目标、产出、问题)。

**回顾与汇总:**
*   **日志历史:** 打开工作日志弹窗时，切换到 "History" (历史) 标签页可查看和编辑该子任务的所有过往记录。
*   **Calendar (日历):** 点击顶部栏的 **Calendar** 按钮，查看活动热力图。点击某一天可查看按项目文件夹着色的用时统计详情。
*   **Done Timeline (完成时间轴):** 点击 "Done Timeline" 查看您完成的所有子任务的时间顺序流。

### 5. 可视化
*   **Timeline (时间轴):** 根据剩余预估时间与您的每日容量，显示工作预测。绿色块代表历史记录，蓝色块代表未来计划。
*   **Analytics (分析):** 饼图和条形图会随着您记录时间自动更新，显示 "计划 vs 实际" 的进度。

### 6. 其他功能
*   **Wishlist (愿望清单):** 用于存放尚未归入具体项目的零散想法或长期目标。
    *   **截止日期:** 设置灵活的截止时间 (月底/年底、长期) 或具体日期。
    *   **Annotations (批注):** 为任何项目添加带有时间戳的备注或想法。
    *   **Tracker Table (追踪表):** 启用 "Tracker" (追踪器) 创建自定义表格，用于监控指标或随时间变化的进度 (支持历史对比)。
*   **Daily Log (日程/每日日志):** 在左侧边栏 (仪表盘视图中)，您可以看到 "Daily Log"。这用于快速记录非项目的待办事项或每日提醒。
    *   **导航:** 点击日期数字可跳转到指定日期。
    *   **任务操作:** 点击圆圈一次标记为 **完成**。再次点击 (在完成状态下) 标记为 **放弃** (可以在弹窗中填写放弃原因)。
    *   **DDLs Off/On:** 切换此按钮可在每日时间轴中显示或隐藏项目的截止日期。

### 7. 部署与在线使用
**在线访问:** [https://thesisflowai.pages.dev/](https://thesisflowai.pages.dev/)

**⚠️ 数据安全须知:**
*   所有数据仅保存在您的 **本地浏览器** (Local Storage) 中。我们没有后台服务器。
*   **建议每日备份:** 如果网站功能更新或浏览器缓存被清除，您的资料 **可能会丢失**。强烈建议您每天点击右上角的 **Backup** 按钮下载 JSON 格式的数据备份。

**如何部署到 Cloudflare Pages (推荐自托管):**
为了防止数据因网页更新而丢失，推荐您将其部署在自己的账号下：
1.  **Fork** 本仓库到您的 GitHub 账号。
2.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) 并进入 **Pages** 页面。
3.  点击 **Connect to Git** 并选择您刚才 Fork 的仓库。
4.  配置构建设置 (Build Settings):
    *   **框架预设 (Framework Preset):** `Vite`
    *   **构建命令 (Build Command):** `npm run build`
    *   **输出目录 (Output Directory):** `dist`
5.  点击 **Save and Deploy**。
