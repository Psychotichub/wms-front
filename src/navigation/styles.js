import { StyleSheet, Platform } from 'react-native';

const styles = StyleSheet.create({
  headerLogo: {
    width: 100,
    height: 40,
    ...Platform.select({
      web: {
        maxWidth: 200,
        height: 80
      }
    })
  },
  headerRightActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: Platform.select({ web: 2, default: 10 }), 
    marginRight: Platform.select({ web: 0, default: 8 }),
    flexShrink: 0
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ web: 2, default: 16 }),
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    ...Platform.select({
      web: {
        maxWidth: '100%',
        overflow: 'hidden',
        paddingHorizontal: 2
      }
    })
  },
  notifBtn: {
    width: Platform.select({ web: 28, default: 36 }),
    height: Platform.select({ web: 28, default: 36 }),
    borderRadius: Platform.select({ web: 14, default: 18 }),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  notifBadgeText: {
    color: '#0b1220',
    fontSize: 11,
    fontWeight: '800'
  },
  themeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ web: 0, default: 6 }),
    paddingHorizontal: Platform.select({ web: 6, default: 8 }),
    paddingVertical: Platform.select({ web: 4, default: 4 }),
    borderRadius: 8,
    flexShrink: 0,
    ...Platform.select({
      web: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center'
      }
    })
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.select({ web: 0, default: 6 }),
    paddingHorizontal: Platform.select({ web: 6, default: 10 }),
    paddingVertical: Platform.select({ web: 4, default: 6 }),
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
    ...Platform.select({
      web: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 0
      }
    })
  },
  ctaText: { 
    fontWeight: '700',
    fontSize: Platform.select({ web: 11, default: 14 })
  },
  menuBtn: { 
    padding: Platform.select({ web: 4, default: 8 }), 
    borderRadius: 10,
    flexShrink: 0,
    minWidth: Platform.select({ web: 32, default: 40 })
  }
});

export default styles;
