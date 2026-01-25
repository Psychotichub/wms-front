import React from 'react';
import { StyleSheet, ScrollView, View, Text } from 'react-native';
import Screen from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';

const AboutScreen = () => {
  const t = useThemeTokens();

  // Helper to convert hex to RGBA for web compatibility
  const getRGBA = (hex, alpha) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
    let fullHex = hex;
    if (hex.length === 4) {
      fullHex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const r = parseInt(fullHex.slice(1, 3), 16);
    const g = parseInt(fullHex.slice(3, 5), 16);
    const b = parseInt(fullHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: t.colors.text }]}>About Us</Text>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>Who We Are</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>
              We are a dedicated team of professionals specializing in Working Management Systems (WMS).
              With years of experience in workforce management, productivity optimization, and software development,
              we have built a comprehensive solution that streamlines work processes and
              enhances productivity for businesses of all sizes.
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>Our Mission</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>
              Our mission is to revolutionize workforce management by providing intuitive, efficient,
              and scalable solutions that empower businesses to optimize their work processes. We believe
              that technology should simplify complex workflows, not complicate them.
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>How We Help</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>
              We help businesses transform their work processes through our comprehensive WMS platform.
              Our solution provides real-time work tracking, automated reporting, efficient task
              management, and seamless integration with existing workflows. We support businesses in:

              • Streamlining daily work processes and reducing manual errors
              • Improving task completion rates and reducing work discrepancies
              • Enhancing workforce productivity with automated workflows and reporting
              • Making data-driven decisions with comprehensive work analytics
              • Scaling operations efficiently as your business grows

              Whether you're managing a small team or overseeing complex multi-department operations,
              our platform adapts to your needs and grows with your business.
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>Our Commitment</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>
              We are committed to providing exceptional service and continuous innovation.
              Our team works closely with clients to understand their unique challenges and
              deliver tailored solutions that drive real results. We believe in building
              long-term partnerships based on trust, reliability, and mutual success.
            </Text>
          </View>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>Contact Us</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>
              Ready to transform your work processes? Get in touch with our team
              to learn how our WMS solution can help streamline your workforce management
              and drive efficiency improvements.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'justify',
  },
});

export default AboutScreen;
