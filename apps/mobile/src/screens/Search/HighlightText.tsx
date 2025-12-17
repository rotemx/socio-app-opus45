import { Text, StyleSheet } from 'react-native';
import { colors } from '@socio/ui';

export interface HighlightTextProps {
  text: string;
  style?: object;
  highlightStyle?: object;
  numberOfLines?: number;
}

/**
 * Renders text with highlighted portions
 * PostgreSQL ts_headline returns text with <b> tags for matches
 */
export function HighlightText({
  text,
  style,
  highlightStyle,
  numberOfLines,
}: HighlightTextProps): React.JSX.Element {
  // Parse text that may contain <b>matched</b> tags from PostgreSQL ts_headline
  const parts = parseHighlightedText(text);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.isMatch ? (
          <Text key={index} style={[styles.highlight, highlightStyle]}>
            {part.text}
          </Text>
        ) : (
          <Text key={index}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

interface TextPart {
  text: string;
  isMatch: boolean;
}

/**
 * Parse text with <b> tags into parts
 */
function parseHighlightedText(text: string): TextPart[] {
  const parts: TextPart[] = [];

  // Match <b>content</b> pattern from PostgreSQL ts_headline
  const regex = /<b>([^<]*)<\/b>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        isMatch: false,
      });
    }
    // Add the matched text
    const matchedText = match[1];
    if (matchedText !== undefined) {
      parts.push({
        text: matchedText,
        isMatch: true,
      });
    }
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      isMatch: false,
    });
  }

  // If no matches found, return the original text
  if (parts.length === 0) {
    parts.push({ text, isMatch: false });
  }

  return parts;
}

const styles = StyleSheet.create({
  highlight: {
    backgroundColor: colors.primaryContainer.light,
    color: colors.onPrimaryContainer.light,
    fontWeight: '600',
  },
});

export default HighlightText;
