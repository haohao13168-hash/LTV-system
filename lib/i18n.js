"use client";

import { createContext, useContext, useEffect, useState } from "react";

const translations = {
  en: {
    appName: "Marketing Console",
    appTag: "Admin Panel",

    // Nav
    navDashboard: "Dashboard",
    navCompanies: "Companies",
    navSettings: "Settings",

    // Common
    search: "Search...",
    cancel: "Cancel",
    save: "Save",
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    actions: "Actions",
    confirm: "Confirm",
    close: "Close",
    optional: "optional",

    // Dashboard
    dashboardTitle: "Dashboard",
    dashboardSubtitle: "Overview of all companies combined.",
    totalMember: "Total Members",
    totalDeposit: "Total Deposit",
    totalWithdraw: "Total Withdraw",
    totalNet: "Total Net",
    valuePerMember: "Value Per Member",
    valuePerMemberHint: "Net ÷ Total Members",
    expand: "Expand",
    collapse: "Collapse",
    openPage: "Open page",
    yourCompanies: "Your Companies",
    company: "Company",
    members: "Members",
    deposit: "Deposit",
    withdraw: "Withdraw",
    net: "Net",
    status: "Status",
    active: "Active",
    paused: "Paused",

    // Companies
    companiesTitle: "Companies",
    companiesSubtitle: "Manage all your companies in one place.",
    addCompany: "Add Company",
    companyName: "Company Name",
    startOn: "Start On",
    noCompanies: "No companies yet. Click \"Add Company\" to start.",

    // Date filter
    dateRange: "Date Range",
    from: "From",
    to: "To",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    last3Months: "3 Months",
    last6Months: "6 Months",
    last9Months: "9 Months",
    last1Year: "1 Year",
    allTime: "All Time",
    clear: "Clear",
    showingData: "Showing data from",
    otherCompanies: "Other Companies",
    noOtherCompanies: "No other companies yet.",
    receivedHint: "Total brought in from all other companies.",
    receivedFrom: "Brought in from",

    // Settings
    settingsTitle: "Settings",
    settingsSubtitle: "Personalize how this console looks and feels.",
    profile: "Profile",
    profileSub: "Your brand identity in this console.",
    appearance: "Appearance",
    appearanceSub: "Theme, accent color, and text size.",
    brandName: "Brand Name",
    brandNameHint: "Shown in the sidebar header.",
    brandInitial: "Initial",
    brandInitialHint: "Letters on the brand logo. Up to 6 characters.",
    brandColor: "Accent Color",
    brandColorHint: "Used for highlights, links, and primary buttons.",
    theme: "Theme",
    themeHint: "Switch between light and dark mode.",
    light: "Light",
    dark: "Dark",
    fontSize: "Font Size",
    fontSizeHint: "Affects all text across the console.",
    small: "Small",
    medium: "Medium",
    large: "Large",
    resetDefaults: "Reset to defaults",
    morningMode: "Morning",
    nightMode: "Night",
    preview: "Preview",
    companiesDisplay: "Companies Display",
    companiesDisplaySub: "Set the avatar color and letter for each company.",
    avatarColor: "Color",
    avatarLetter: "Letter",
    granularity: "Granularity",
    custom: "Custom",
    daysCount: "days",
    viewSummary: "Summary",
    viewDaily: "Daily entry",

    // Daily entries
    dailyEntries: "Daily Entries",
    addEntry: "Add Entry",
    editEntry: "Edit Entry",
    date: "Date",
    noEntries: "No daily entries yet.",
    noEntriesHint: "Click \"Add Entry\" to log members and revenue for a day.",
    entryDateRequired: "Date is required.",

    // Auth
    signIn: "Sign In",
    signOut: "Sign Out",
    username: "Username",
    password: "Password",
    welcomeBack: "Welcome back",
    signInSubtitle: "Sign in to continue to your console.",
    invalidCredentials: "Invalid username or password.",
    demoHint: "Demo: use admin / admin",

    // Users
    navUsers: "Users",
    usersTitle: "Users",
    usersSubtitle: "Manage who can sign in to the console.",
    addUser: "Add User",
    editUser: "Edit User",
    deleteUser: "Delete User",
    deleteUserDesc: "Are you sure you want to delete this user? They will no longer be able to sign in.",
    fullName: "Full Name",
    role: "Role",
    roleAdmin: "Admin",
    roleAgent: "Agent",
    roleViewer: "Viewer",
    you: "You",
    noPermission: "No permission",
    noPermissionSettings: "You don't have permission to change settings. Ask an admin or agent.",
    noPermissionUsers: "You don't have permission to manage users.",
    usernameRequired: "Username is required.",
    passwordRequired: "Password is required.",
    usernameTaken: "That username is already taken.",
    cannotDeleteSelf: "You can't delete yourself.",

    // Main company concept
    mainCompany: "Main Company",
    setAsMain: "Set as Main Company",
    mainHint: "Numbers shown are the total brought in by all other companies.",
    contributedBy: "Contributed by",

    // Add / Edit Company Modal
    addCompanyTitle: "Add New Company",
    addCompanyDesc: "Enter the details of the new company.",
    editCompanyTitle: "Edit Company",
    editCompanyDesc: "Update the details of this company.",
    companyNamePlaceholder: "e.g. Acme Marketing",
    nameRequired: "Company name is required.",

    // Delete confirm
    deleteCompanyTitle: "Delete Company",
    deleteCompanyDesc: "Are you sure you want to delete this company? This cannot be undone.",

    // Company detail page
    backToCompanies: "Back to Companies",
    companyDetails: "Company Details",
    notFound: "Company not found.",

    // Language
    language: "Language",
    english: "English",
    chinese: "中文",
  },
  zh: {
    appName: "营销管理台",
    appTag: "后台管理",

    // Nav
    navDashboard: "总览",
    navCompanies: "公司列表",
    navSettings: "设置",

    // Common
    search: "搜索...",
    cancel: "取消",
    save: "保存",
    add: "添加",
    edit: "编辑",
    delete: "删除",
    actions: "操作",
    confirm: "确认",
    close: "关闭",
    optional: "选填",

    // Dashboard
    dashboardTitle: "总览",
    dashboardSubtitle: "所有公司汇总数据。",
    totalMember: "总会员数",
    totalDeposit: "总存款",
    totalWithdraw: "总提款",
    totalNet: "总净额",
    valuePerMember: "每位会员价值",
    valuePerMemberHint: "净额 ÷ 总会员数",
    expand: "展开",
    collapse: "收起",
    openPage: "打开页面",
    yourCompanies: "你的公司",
    company: "公司",
    members: "会员",
    deposit: "存款",
    withdraw: "提款",
    net: "净额",
    status: "状态",
    active: "活跃",
    paused: "暂停",

    // Companies
    companiesTitle: "公司列表",
    companiesSubtitle: "在这里管理你所有的公司。",
    addCompany: "添加公司",
    companyName: "公司名称",
    startOn: "开始日期",
    noCompanies: "还没有公司。点击 “添加公司” 开始。",

    // Date filter
    dateRange: "日期范围",
    from: "从",
    to: "到",
    daily: "每日",
    weekly: "每周",
    monthly: "每月",
    last3Months: "3 个月",
    last6Months: "6 个月",
    last9Months: "9 个月",
    last1Year: "1 年",
    allTime: "全部时间",
    clear: "清除",
    showingData: "显示数据范围",
    otherCompanies: "其他公司",
    noOtherCompanies: "目前没有其他公司。",
    receivedHint: "其他所有公司带进来的总和。",
    receivedFrom: "带进来自",

    // Settings
    settingsTitle: "设置",
    settingsSubtitle: "个性化你的控制台外观。",
    profile: "品牌",
    profileSub: "你在控制台里的品牌标识。",
    appearance: "外观",
    appearanceSub: "主题、强调色、文字大小。",
    brandName: "品牌名称",
    brandNameHint: "显示在左侧菜单顶部。",
    brandInitial: "字母图标",
    brandInitialHint: "品牌图标里的字母。最多 6 个字符。",
    brandColor: "强调色",
    brandColorHint: "用于高亮、链接和主要按钮。",
    theme: "主题",
    themeHint: "切换日间或夜间模式。",
    light: "日间",
    dark: "夜间",
    fontSize: "字体大小",
    fontSizeHint: "影响整个控制台的文字大小。",
    small: "小",
    medium: "中",
    large: "大",
    resetDefaults: "恢复默认",
    morningMode: "日间",
    nightMode: "夜间",
    preview: "预览",
    companiesDisplay: "公司外观",
    companiesDisplaySub: "为每家公司设置头像颜色和字母。",
    avatarColor: "颜色",
    avatarLetter: "字母",
    granularity: "时间粒度",
    custom: "自定义",
    daysCount: "天",
    viewSummary: "汇总",
    viewDaily: "每日录入",

    // Daily entries
    dailyEntries: "每日数据",
    addEntry: "添加记录",
    editEntry: "编辑记录",
    date: "日期",
    noEntries: "还没有每日数据。",
    noEntriesHint: "点 “添加记录” 录入某天的会员数和收入。",
    entryDateRequired: "请填写日期。",

    // Auth
    signIn: "登录",
    signOut: "退出",
    username: "用户名",
    password: "密码",
    welcomeBack: "欢迎回来",
    signInSubtitle: "登录后继续使用控制台。",
    invalidCredentials: "用户名或密码错误。",
    demoHint: "演示账号：admin / admin",

    // Users
    navUsers: "用户管理",
    usersTitle: "用户",
    usersSubtitle: "管理可登录控制台的账号。",
    addUser: "添加用户",
    editUser: "编辑用户",
    deleteUser: "删除用户",
    deleteUserDesc: "确定要删除该用户吗？删除后无法再登录。",
    fullName: "姓名",
    role: "角色",
    roleAdmin: "管理员",
    roleAgent: "代理",
    roleViewer: "查看者",
    you: "你自己",
    noPermission: "无权限",
    noPermissionSettings: "你没有权限修改设置。请联系管理员或代理。",
    noPermissionUsers: "你没有权限管理用户。",
    usernameRequired: "请输入用户名。",
    passwordRequired: "请输入密码。",
    usernameTaken: "该用户名已存在。",
    cannotDeleteSelf: "无法删除当前登录的用户。",

    // Main company concept
    mainCompany: "主公司",
    setAsMain: "设为主公司",
    mainHint: "显示的数字是所有其他公司带给主公司的总和。",
    contributedBy: "来自",

    // Add / Edit Company Modal
    addCompanyTitle: "添加新公司",
    addCompanyDesc: "请填写新公司的基本资料。",
    editCompanyTitle: "编辑公司",
    editCompanyDesc: "更新该公司的资料。",
    companyNamePlaceholder: "例如：Acme 营销",
    nameRequired: "公司名称为必填项。",

    // Delete confirm
    deleteCompanyTitle: "删除公司",
    deleteCompanyDesc: "确定要删除这家公司吗？此操作无法撤销。",

    // Company detail page
    backToCompanies: "返回公司列表",
    companyDetails: "公司详情",
    notFound: "找不到该公司。",

    // Language
    language: "语言",
    english: "English",
    chinese: "中文",
  },
};

const I18nContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const saved = typeof window !== "undefined" && window.localStorage.getItem("lang");
    if (saved === "en" || saved === "zh") setLang(saved);
  }, []);

  const update = (l) => {
    setLang(l);
    if (typeof window !== "undefined") window.localStorage.setItem("lang", l);
  };

  const t = (key) => translations[lang]?.[key] ?? translations.en[key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, setLang: update, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
