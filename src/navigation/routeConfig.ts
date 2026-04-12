// @ts-nocheck
/** Screens shown as bottom tabs inside `MainTabs` */
export const MAIN_TAB_ROUTE_NAMES = ['Dashboard', 'Daily Report', 'My Tasks'];

/** Labels for web breadcrumbs (route name → display) */
export const ROUTE_BREADCRUMB_LABELS = {
  MainTabs: 'Home',
  Dashboard: 'Dashboard',
  'Daily Report': 'Daily Report',
  'My Tasks': 'My Tasks',
  Received: 'Received',
  Panel: 'Panel',
  'Add Material': 'Add Material',
  Price: 'Price',
  Inventory: 'Inventory',
  'Contract Quantity': 'Contracts',
  'Create User': 'Create User',
  Employee: 'Employees',
  'Task Management': 'Tasks',
  'Todo List': 'Todos',
  'Task Detail': 'Task',
  Notifications: 'Notifications',
  'Location Selection': 'Location',
  'Attendance Status': 'Attendance',
  'Attendance History': 'History',
  'Manage Locations': 'Locations',
  'Isolation Test': 'Isolation',
  Setting: 'Settings',
  About: 'About',
  'Global Search': 'Search',
  'Access Denied': 'Access denied'
};

export const appScreenConfig = [
  {
    name: 'Dashboard',
    getComponent: () => require('../screens/DashboardScreen').default,
    drawer: { label: 'Dashboard', icon: 'grid-outline' }
  },
  {
    name: 'Daily Report',
    getComponent: () => require('../screens/DailyReportScreen').default,
    drawer: { label: 'Daily Report', icon: 'document-text-outline' }
  },
  {
    name: 'Received',
    getComponent: () => require('../screens/ReceivedScreen').default,
    drawer: { label: 'Received', icon: 'cube-outline' }
  },
  {
    name: 'Panel',
    getComponent: () => require('../screens/PanelScreen').default,
    roles: ['admin'],
    drawer: { label: 'Panel', icon: 'git-branch-outline' }
  },
  {
    name: 'Add Material',
    getComponent: () => require('../screens/AddMaterialScreen').default,
    roles: ['admin'],
    drawer: { label: 'Add Material', icon: 'add-circle-outline' }
  },
  {
    name: 'Price',
    getComponent: () => require('../screens/PriceScreen').default,
    roles: ['admin'],
    drawer: { label: 'Price', icon: 'pricetags-outline' }
  },
  {
    name: 'Inventory',
    getComponent: () => require('../screens/InventoryScreen').default,
    drawer: { label: 'Inventory', icon: 'cube-outline' }
  },
  {
    name: 'Contract Quantity',
    getComponent: () => require('../screens/ContractQuantityScreen').default,
    roles: ['admin'],
    drawer: { label: 'Contract Management', icon: 'document-text-outline' }
  },
  {
    name: 'Create User',
    getComponent: () => require('../screens/CreateUserScreen').default,
    roles: ['admin']
  },
  {
    name: 'Employee',
    getComponent: () => require('../screens/EmployeeScreen').default,
    roles: ['admin'],
    drawer: { label: 'Employee', icon: 'people-outline' }
  },
  {
    name: 'Task Management',
    getComponent: () => require('../screens/TaskScreen').default,
    roles: ['admin'],
    drawer: { label: 'Task Management', icon: 'list-outline' }
  },
  {
    name: 'My Tasks',
    getComponent: () => require('../screens/MyTasksScreen').default,
    drawer: { label: 'My Tasks', icon: 'checkmark-done-outline' }
  },
  {
    name: 'Todo List',
    getComponent: () => require('../screens/TodoListScreen').default,
    drawer: { label: 'Todo List', icon: 'list-outline' }
  },
  {
    name: 'Task Detail',
    getComponent: () => require('../screens/TaskDetailScreen').default
  },
  {
    name: 'Notifications',
    getComponent: () => require('../screens/NotificationsScreen').default
  },
  {
    name: 'Location Selection',
    getComponent: () => require('../screens/LocationSelectionScreen').default
  },
  {
    name: 'Attendance Status',
    getComponent: () => require('../screens/AttendanceStatusScreen').default,
    drawer: { label: 'Attendance Status', icon: 'time-outline' }
  },
  {
    name: 'Attendance History',
    getComponent: () => require('../screens/AttendanceHistoryScreen').default
  },
  {
    name: 'Manage Locations',
    getComponent: () => require('../screens/ManageLocationsScreen').default,
    roles: ['admin']
  },
  {
    name: 'Isolation Test',
    getComponent: () => require('../screens/IsolationTestScreen').default,
    drawer: { label: 'Isolation Test', icon: 'flask-outline' }
  },
  {
    name: 'Setting',
    getComponent: () => require('../screens/SettingsScreen').default,
    drawer: { label: 'Setting', icon: 'settings-outline' }
  },
  {
    name: 'About',
    getComponent: () => require('../screens/AboutScreen').default,
    drawer: { label: 'About', icon: 'information-circle-outline' }
  },
  {
    name: 'Global Search',
    getComponent: () => require('../screens/GlobalSearchScreen').default
  },
  {
    name: 'Access Denied',
    getComponent: () => require('../screens/AccessDeniedScreen').default
  }
];

export const getAllowedRouteNames = (role = 'user') => {
  const names = appScreenConfig
    .filter((screen) => !screen.roles || screen.roles.includes(role))
    .map((screen) => screen.name);
  const extras = ['MainTabs'].filter((n) => !names.includes(n));
  return [...extras, ...names];
};
