import './ds.css'

// Lựa chọn dạng card (components/choice-controls.md, "Card chọn"): đang chọn là viền màu nhấn + ring mờ.
// option: { value, title, description, aside, disabled }
export default function ChoiceCardGroup({ name, legend, options, value, onChange, columns = 1 }) {
  return (
    <fieldset className="ds-choice">
      {legend ? <legend className="ds-choice__legend">{legend}</legend> : null}
      <div className="ds-choice__grid" style={{ '--ds-choice-columns': columns }}>
        {options.map((option) => (
          <label key={option.value} className={`ds-choice__card${option.disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange?.(option.value)}
              className="ds-choice__radio"
            />
            <span className="ds-choice__text">
              <span className="ds-choice__title">
                {option.title}
                {option.aside ? <span className="ds-choice__aside">{option.aside}</span> : null}
              </span>
              {option.description ? <span className="ds-choice__desc">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
