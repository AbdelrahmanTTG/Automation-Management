// import { LanguagesData, languageDataType } from "@/Data/HeaderData/Language";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
// import { useTranslation } from "react-i18next";

const LanguageClass = () => {
  const [langdropdown, setLangdropdown] = useState(false);
  // const { i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage;
  const [selectedLang, setSelectedLang] = useState<any>({});
  const router = useRouter();
  const [lang, setLang] = useState("EN");
  const [flag, setFlag] = useState("us");
  const changeLng = (lng: languageDataType) => {
    setLang(lng.data);
    setFlag(lng.logo);
    // i18n.changeLanguage(lng.data);
  };

  const LanguageSelection = (language: any) => {
    if (language) {
      setLangdropdown(!language);
    } else {
      setLangdropdown(!language);
    }
  };

  useEffect(() => {
    const defaultLanguage = LanguagesData.find((data) => data.data == currentLanguage);
    setSelectedLang(defaultLanguage);
    router.refresh();
  }, []);
  
  useEffect(() => {
    if (lang === "ae") {
      document.body.classList.add("rtl");
      document.body.classList.remove("ltr");
      document.body.classList.remove("box-layout");
      document.documentElement.dir = "rtl";
    } else {
      document.body.classList.add("ltr");
      document.body.classList.remove("rtl");
      document.body.classList.remove("box-layout");
      document.documentElement.dir = "ltr";
    }
  }, [lang])
  
  return (
    <Fragment>
      <li className='onhover-dropdown'>
        <div className={`translate_wrapper ${langdropdown ? "active" : ""}`}>
          <div className='current_lang'>
            <div className='lang d-flex' onClick={() => LanguageSelection(langdropdown)}>
              <i className={`flag-icon flag-icon-${flag}`}></i>
              <span className='lang-txt'>{lang}</span>
            </div>
          </div>

          <div className={`more_lang onhover-show-div ${langdropdown ? "active" : ""}`}>
            {/* {LanguagesData.map((item, i) => (
              <div key={i} className='lang' onClick={() => changeLng(item)}>
                <div className='lang-txt' data-lng={item.data}>
                  <i className={item.logo} /> {item.language}
                </div>
              </div>
            ))} */}
          </div>
        </div>
      </li>
    </Fragment>
  );
};

export default LanguageClass;
