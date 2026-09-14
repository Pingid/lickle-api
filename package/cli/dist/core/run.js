import mri from 'mri';
export const run = (_t, argv) => {
    const args = parse(argv);
    console.log(args);
};
const parse = (argv) => mri(argv);
//# sourceMappingURL=run.js.map