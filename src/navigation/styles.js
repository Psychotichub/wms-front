import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  headerLogo: {
    width: 100,
    height: 40
  },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'center'
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
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
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1
  },
  ctaText: { fontWeight: '700' },
  menuBtn: { padding: 8, borderRadius: 10 }
});

export default styles;
