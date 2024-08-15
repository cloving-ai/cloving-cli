export const getModel = (): string => {
  return process.env.CLOVING_MODEL || 'claude:claude-3-5-sonnet-20240620';
};
