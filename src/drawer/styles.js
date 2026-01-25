import { Dimensions, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: Dimensions.get('window').width * 0.78,
    maxWidth: 360
  },
  drawerContent: {
    flex: 1
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  drawerLogo: { width: 80, height: 32 },
  drawerTitle: { fontSize: 16, fontWeight: '700' },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)'
  },
  drawerItemIcon: {
    marginRight: 12
  },
  drawerItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1
  },
  drawerBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  drawerBadgeText: {
    fontSize: 12,
    fontWeight: '700'
  }
});

export default styles;
