
// import { EyeIcon, EyeSlashIcon } from "./icons"; // Импортируем иконки


export const InputField = (InputText) => {
    return (
        <>

        </>
    )
};

// export const TextField = ({ inputText, FclassName }) => {
//     return (
//         <div>
//             <label className={FclassName}>
//                 {inputText}
//             </label>
//         </div>

//     )

// };


export const TextField = ({
    text,
    variant = 'default', // 'title' | 'subtitle'
    style
}) => {
    const baseStyle = {
        fontFamily: 'Inter',
        // color: '#000000',
        ...style
    };

    const variants = {
        title: {
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '39px',
            color: '#0000ff',
            textAlign: 'center'
        },
        subtitle: {
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: '24px'
        },
        default: {}
    };

    return (
        <div style={{ ...baseStyle, ...variants[variant] }}>
            {text}
        </div>
    );
};